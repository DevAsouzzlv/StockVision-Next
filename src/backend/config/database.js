const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/stockvision';
        const conn = await mongoose.connect(uri);
        console.log(`[MongoDB] Base de dados conectada com sucesso: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Erro MongoDB] Não foi possível conectar ao MongoDB: ${error.message}`);
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        } else {
            console.warn('[MongoDB] Modo desenvolvimento: O servidor permanecerá ativo para servir a interface.');
        }
    }
};

module.exports = connectDB;