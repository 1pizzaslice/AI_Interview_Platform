import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from './logger';

export async function connectDB(): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info('[MongoDB] Connected');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error({ err }, '[MongoDB] Connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('[MongoDB] Disconnected');
  });

  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('[MongoDB] Disconnected gracefully');
}
