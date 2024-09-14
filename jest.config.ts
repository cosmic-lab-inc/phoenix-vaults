import { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/dist"],
  testTimeout: 3 * 60 * 1000,
  openHandlesTimeout: 10 * 1000,
  workerIdleMemoryLimit: '512MB'
};

export default config;