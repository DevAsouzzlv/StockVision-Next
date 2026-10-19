const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: [true, 'O nome completo é obrigatório.'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'O e-mail é obrigatório.'],
        unique: true, // Garante que não existem e-mails duplicados no sistema
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor, insira um e-mail válido.']
    },
    company: {
        type: String,
        required: [true, 'O nome da empresa é obrigatório.'],
        trim: true
    },
    password: {
        type: String,
        required: [true, 'A senha é obrigatória.'],
        minlength: [6, 'A senha deve conter no mínimo 6 caracteres.']
    },
    isAdmin: {
        type: Boolean,
        default: false // Por padrão, novos utilizadores não são administradores
    },
    isActive: {
        type: Boolean,
        default: true // Permite ao ADM bloquear ou desativar credenciais de funcionários
    },
    phone: {
        type: String,
        default: ''
    },
    jobTitle: {
        type: String,
        default: ''
    },
    avatarUrl: {
        type: String,
        default: ''
    },
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'system'
        },
        soundAlerts: {
            type: Boolean,
            default: true
        },
        tableDensity: {
            type: String,
            enum: ['comfortable', 'compact'],
            default: 'comfortable'
        },
        emailNotifications: {
            type: Boolean,
            default: true
        }
    },
    companyDetails: {
        cnpj: { type: String, default: '' },
        segment: { type: String, default: 'Logística e Armazenagem' },
        address: { type: String, default: '' }
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

/**
 * Middleware do Mongoose (Pre-save hook)
 * Executado automaticamente antes de guardar o utilizador na base de dados.
 * Criptografa a senha caso esta tenha sido modificada ou criada.
 */
UserSchema.pre('save', async function (next) {
    const user = this;

    // Se a senha não foi modificada, avança para o próximo passo
    if (!user.isModified('password')) return next();

    try {
        // Gera o salt e aplica o hash à senha utilizando bcrypt
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(user.password, salt);
        
        // Substitui a senha em texto limpo pelo hash gerado
        user.password = hash;
        next();
    } catch (error) {
        return next(error);
    }
});

/**
 * Método Auxiliar Personalizado
 * Compara a senha fornecida no login com o hash guardado na base de dados.
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);