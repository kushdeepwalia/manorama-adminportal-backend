module.exports = {
  apps: [
    {
      name: 'gateway',
      cwd: './api-gateway',
      script: './api-gateway/index.js',
      ignore_watch: ["node_modules"],
      env: {
        PORT: 2000
      }
    },
    {
      name: 'auth',
      cwd: './auth-service',
      ignore_watch: ["node_modules", "tmp"],
      script: './auth-service/index.js',
      env: {
        PORT: 4000
      }
    },
    {
      name: 'project',
      cwd: './project-service',
      script: './project-service/index.js',
      ignore_watch: ["node_modules"],
      env: {
        PORT: 4400
      }
    },
    {
      name: 'model',
      cwd: './model-service',
      script: './model-service/index.js',
      ignore_watch: ["node_modules"],
      env: {
        PORT: 4800
      }
    },
    {
      name: 'organization',
      cwd: './organization-service',
      script: './organization-service/index.js',
      ignore_watch: ["node_modules"],
      env: {
        PORT: 5200
      }
    },
    {
      name: 'admin',
      cwd: './admin-service',
      script: './admin-service/index.js',
      ignore_watch: ["node_modules"],
      env: {
        PORT: 5600
      }
    }
  ]
};
