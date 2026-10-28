import mongoose from 'mongoose';
import dns from 'node:dns/promises';

let listenersAttached = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri || uri.startsWith('your_')) {
    throw new Error(
      'MONGODB_URI is missing or still a placeholder. Set it in backend/.env.'
    );
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // Optional override: comma-separated DNS server IP addresses.
  // For local development, use the Google DNS servers that
  // successfully resolved this project's Atlas hostname.
  // Production keeps the system DNS unless explicitly configured.
  const configuredServers = process.env.DNS_SERVERS?.trim();

  const dnsServers = configuredServers
    ? configuredServers
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean)
    : process.env.NODE_ENV === 'development'
      ? ['8.8.8.8', '8.8.4.4']
      : [];

  if (uri.startsWith('mongodb+srv://') && dnsServers.length > 0) {
    dns.setServers(dnsServers);
  }

  mongoose.set('strictQuery', true);

  if (!listenersAttached) {
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected.');
    });

    listenersAttached = true;
  }

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(
    `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`
  );

  return conn;
};

export const disconnectDB = async () => {
  await mongoose.connection.close();
};

export default connectDB;