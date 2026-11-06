import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

// 18 §10.7: testar no celular real pelo IP do computador, na mesma rede (npm run dev:rede).
const ipsLocais = Object.values(networkInterfaces())
  .flat()
  .filter((rede) => rede && rede.family === 'IPv4' && !rede.internal)
  .map((rede) => rede!.address);

const config: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ipsLocais,
};

export default config;
