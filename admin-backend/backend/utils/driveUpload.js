const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const auth = require('./driveAuth');

const uploadToDrive = async (filePath, fileName, parentFolderId) => {
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath),
    },
  });

  return res.data;
};

module.exports = uploadToDrive;
