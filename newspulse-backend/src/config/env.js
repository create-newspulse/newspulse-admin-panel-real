import dotenv from 'dotenv';
dotenv.config();

const getArray = (v) => (v ? v.split(',').map(s => s.trim()) : []);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGO_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '30d',
  },
  corsOrigins: getArray(process.env.CORS_ORIGINS),
  uploadDir: process.env.UPLOAD_DIR ?? 'src/uploads',
  maxFileMb: Number(process.env.MAX_FILE_MB ?? 8),
};
