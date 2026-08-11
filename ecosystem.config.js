module.exports = {
  apps: [
    {
      name: 'nestjs-cluster',
      script: 'dist/main.js',
      instances: '5', // Spawns as many workers as you have CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
