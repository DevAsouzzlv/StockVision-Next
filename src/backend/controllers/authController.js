const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Função auxiliar para gerar o Token JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d'
    });
};

/**
 * LÓGICA DE CADASTRO (REGISTRO INICIAL DA EMPRESA)
 * Blindagem Multitenancy: Impede que terceiros se vinculem a empresas existentes sem convite
 */
exports.register = async (req, res) => {
    try {
        const { fullname, email, company, password } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Este e-mail já está em uso no sistema.' });
        }

        const companyExists = await User.findOne({ 
            company: { $regex: new RegExp(`^${company.trim()}$`, 'i') } 
        });

        if (companyExists) {
            return res.status(400).json({ 
                message: 'Esta organização/empresa já possui cadastro ativo no StockVision. Para novos colaboradores, solicite acesso ao Administrador da sua empresa.' 
            });
        }

        const newUser = await User.create({
            fullname,
            email,
            company: company.trim(),
            password,
            isAdmin: true // O primeiro usuário a registrar a organização é sempre o Administrador
        });

        return res.status(201).json({
            message: 'Usuário cadastrado com sucesso!',
            token: generateToken(newUser._id),
            user: {
                id: newUser._id,
                fullname: newUser.fullname,
                email: newUser.email,
                company: newUser.company,
                isAdmin: newUser.isAdmin
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao processar o cadastro.', error: error.message });
    }
};

/**
 * LÓGICA DE LOGIN GERAL
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas (E-mail ou senha incorretos).' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'Esta conta foi desativada pelo Administrador da empresa.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas (E-mail ou senha incorretos).' });
        }

        return res.status(200).json({
            message: 'Autenticação bem-sucedida!',
            token: generateToken(user._id),
            user: {
                id: user._id,
                fullname: user.fullname,
                email: user.email,
                company: user.company,
                isAdmin: user.isAdmin,
                phone: user.phone || '',
                jobTitle: user.jobTitle || '',
                avatarUrl: user.avatarUrl || '',
                preferences: user.preferences || { theme: 'system', soundAlerts: true, tableDensity: 'comfortable', emailNotifications: true },
                companyDetails: user.companyDetails || { cnpj: '', segment: 'Logística e Armazenagem', address: '' }
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao processar o login.', error: error.message });
    }
};

/**
 * LÓGICA EXCLUSIVA DO ADM: REGISTRAR FUNCIONÁRIO
 * Regra de Negócio: Herda automaticamente a empresa do ADM logado (bloqueado para o funcionário)
 * e define forçadamente isAdmin como false.
 */
exports.registerEmployee = async (req, res) => {
    try {
        const { fullname, email, password } = req.body;

        // 1. O middleware 'protect' injetou o ADM em req.user. Vamos capturar a empresa dele.
        const adminCompany = req.user.company;

        // 2. Validar se o e-mail do novo funcionário já existe no sistema global
        const employeeExists = await User.findOne({ email });
        if (employeeExists) {
            return res.status(400).json({ message: 'Este e-mail já está registado no ecossistema StockVision.' });
        }

        // 3. Cria a conta do funcionário vinculada à organização jurídica do ADM
        const newEmployee = await User.create({
            fullname,
            email,
            company: adminCompany, // Herança forçada e bloqueada da empresa
            password,
            isAdmin: false // Garantia de infraestrutura que a conta não terá privilégios de ADM
        });

        return res.status(201).json({
            message: `Funcionário registado com sucesso para a empresa ${adminCompany}!`,
            employee: {
                id: newEmployee._id,
                fullname: newEmployee.fullname,
                email: newEmployee.email,
                company: newEmployee.company,
                isAdmin: newEmployee.isAdmin,
                isActive: newEmployee.isActive
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao registar funcionário.', error: error.message });
    }
};

/**
 * LÓGICA EXCLUSIVA DO ADM: LISTAR FUNCIONÁRIOS DA SUA EMPRESA
 * Isolamento Multitenant: O ADM só vê os funcionários da própria organização.
 */
exports.listEmployees = async (req, res) => {
    try {
        const adminCompany = req.user.company;

        // Procura todos os utilizadores daquela empresa que NÃO sejam o próprio ADM
        const employees = await User.find({ 
            company: adminCompany, 
            _id: { $ne: req.user._id } 
        }).select('-password'); // Oculta o hash das senhas por segurança na listagem

        return res.status(200).json(employees);
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao listar funcionários.', error: error.message });
    }
};

/**
 * LÓGICA EXCLUSIVA DO ADM: ALTERAR SENHA OU STATUS DO FUNCIONÁRIO
 * Objetivo: Permitir que apenas o ADM gerencie as credenciais da sua empresa.
 */
exports.updateEmployeeCredentials = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { password, isActive } = req.body;
        const adminCompany = req.user.company;

        // 1. Buscar o funcionário garantindo que ele pertence à MESMA empresa do ADM
        const employee = await User.findOne({ _id: employeeId, company: adminCompany });

        if (!employee) {
            return res.status(404).json({ message: 'Funcionário não encontrado ou não pertence à sua organização.' });
        }

        // 2. Se o ADM enviou uma nova senha, atualiza (o pre-save hook do Mongoose vai criptografar automaticamente)
        if (password) {
            employee.password = password;
        }

        // 3. Se o ADM alterou o status de ativação da conta (Ativo/Inativo)
        if (typeof isActive !== 'undefined') {
            employee.isActive = isActive;
        }

        await employee.save();

        return res.status(200).json({
            message: `Credenciais do funcionário ${employee.fullname} atualizadas com sucesso!`,
            employee: {
                id: employee._id,
                fullname: employee.fullname,
                email: employee.email,
                isActive: employee.isActive
            }
        });

    } catch (error) {
        return res.status(500).json({ message: 'Erro ao gerenciar credenciais.', error: error.message });
    }
};

/**
 * SOLICITAR RECUPERAÇÃO DE SENHA (ESQUECI MINHA SENHA)
 * POST -> /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Por favor, informe seu e-mail cadastrado.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            // Mensagem genérica por boas práticas de segurança contra enumeração de e-mails
            return res.status(200).json({
                message: 'Se este e-mail estiver cadastrado no sistema, você receberá um link seguro para redefinição de senha.',
                simulated: false
            });
        }

        // Gera token criptográfico seguro
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Define validade de 1 hora (3600000 ms)
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const resetUrl = `/views/reset-password.html?token=${rawToken}`;

        console.log(`[Segurança] Link de redefinição de senha gerado para ${user.email}: ${resetUrl}`);

        return res.status(200).json({
            message: 'Instruções para redefinição de senha geradas com sucesso. Verifique seu e-mail corporativo.',
            resetUrl,
            resetToken: rawToken,
            expiresInMinutes: 60
        });

    } catch (error) {
        console.error('[AuthController - Forgot Password Error]:', error.message);
        return res.status(500).json({ message: 'Erro interno ao processar recuperação de senha.', error: error.message });
    }
};

/**
 * EFETUAR REDEFINIÇÃO DE SENHA VIA TOKEN
 * POST -> /api/auth/reset-password/:token
 */
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'A nova senha deve conter no mínimo 6 caracteres.' });
        }

        // Aplica o hash sha256 no token recebido para comparar com a base de dados
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token de redefinição inválido, expirado ou já utilizado. Solicite um novo link.' });
        }

        // Atualiza a senha (o pre-save hook do Mongoose aplicará o hash bcrypt automaticamente)
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.status(200).json({
            message: 'Senha redefinida com sucesso! Você já pode fazer login com suas novas credenciais.'
        });

    } catch (error) {
        console.error('[AuthController - Reset Password Error]:', error.message);
        return res.status(500).json({ message: 'Erro ao redefinir senha.', error: error.message });
    }
};

/**
 * OBTER PERFIL COMPLETO DO USUÁRIO LOGADO
 * GET -> /api/auth/profile
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não localizado.' });
        }

        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao carregar perfil.', error: error.message });
    }
};

/**
 * ATUALIZAR DADOS PESSOAIS, EMPRESA E PREFERÊNCIAS DO PERFIL
 * PUT -> /api/auth/profile
 */
exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não localizado.' });
        }

        const { fullname, phone, jobTitle, avatarUrl, preferences, companyDetails } = req.body;

        if (fullname) user.fullname = fullname.trim();
        if (typeof phone !== 'undefined') user.phone = phone.trim();
        if (typeof jobTitle !== 'undefined') user.jobTitle = jobTitle.trim();
        if (typeof avatarUrl !== 'undefined') user.avatarUrl = avatarUrl.trim();

        if (preferences && typeof preferences === 'object') {
            user.preferences = {
                theme: preferences.theme || user.preferences?.theme || 'system',
                soundAlerts: typeof preferences.soundAlerts !== 'undefined' ? preferences.soundAlerts : user.preferences?.soundAlerts,
                tableDensity: preferences.tableDensity || user.preferences?.tableDensity || 'comfortable',
                emailNotifications: typeof preferences.emailNotifications !== 'undefined' ? preferences.emailNotifications : user.preferences?.emailNotifications
            };
        }

        // Apenas o Administrador pode atualizar dados fiscais e cadastrais da empresa
        if (companyDetails && user.isAdmin) {
            user.companyDetails = {
                cnpj: companyDetails.cnpj || user.companyDetails?.cnpj || '',
                segment: companyDetails.segment || user.companyDetails?.segment || 'Logística e Armazenagem',
                address: companyDetails.address || user.companyDetails?.address || ''
            };
        }

        await user.save();

        return res.status(200).json({
            message: 'Perfil e preferências atualizados com sucesso!',
            user: {
                id: user._id,
                fullname: user.fullname,
                email: user.email,
                company: user.company,
                isAdmin: user.isAdmin,
                phone: user.phone,
                jobTitle: user.jobTitle,
                avatarUrl: user.avatarUrl,
                preferences: user.preferences,
                companyDetails: user.companyDetails
            }
        });

    } catch (error) {
        console.error('[AuthController - Update Profile Error]:', error.message);
        return res.status(500).json({ message: 'Erro ao atualizar perfil.', error: error.message });
    }
};