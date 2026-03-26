module.exports = {
  apps: [
    {
      name: "relay-bot",
      script: "pnpm",
      args: "start",
      cwd: __dirname,
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
