module.exports = {
  apps: [
    {
      name: 'gateway',
      script: './api-gateway/index.js',
      env: {
        PORT: 2000
      }
    },
    {
      name: 'auth',
      script: './auth-service/index.js',
      env: {
        PORT: 4000
      }
    },
    {
      name: 'project',
      script: './project-service/index.js',
      env: {
        PORT: 4400
      }
    },
    {
      name: 'model',
      script: './model-service/index.js',
      env: {
        PORT: 4800
      }
    },
    {
      name: 'organization',
      script: './organization-service/index.js',
      env: {
        PORT: 5200
      }
    },
    {
      name: 'admin',
      script: './admin-service/index.js',
      env: {
        PORT: 5600
      }
    }
  ]
};
