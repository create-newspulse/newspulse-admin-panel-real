// backend/utils/driveAuth.js
const path = require('path');
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../../config/drive-key.json'),
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

module.exports = auth;
