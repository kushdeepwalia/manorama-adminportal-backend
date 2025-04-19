const bcrypt = require('bcrypt');

const saltRounds = 10; // Cost factor

// Hash a password
async function hashPassword(plainPassword) {
  const hashed = await bcrypt.hash(plainPassword, saltRounds);
  return hashed;
}

// Compare password with hashed password
async function comparePassword(plainPassword, hashedPassword) {
  const match = await bcrypt.compare(plainPassword, hashedPassword);
  return match; // true or false
}

const password = {
  hash: hashPassword,
  compare: comparePassword
}

module.exports = password;