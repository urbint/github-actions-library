const core = require('@actions/core');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function updateImageTag() {
  try {
    // Get inputs
    const bucketPath = core.getInput('bucket-path');
    const imageTag = core.getInput('image-tag');
    const credentialsJson = core.getInput('credentials-json');
    
    // Authenticate using the credentials JSON
    const storage = new Storage({
      keyFilename: credentialsJson,
    });
    
    // Assuming the image is stored as a .tar file (adjust this as needed)
    const sourceImagePath = `gs://${bucketPath}/${imageTag}.tar`;
    const updatedImagePath = `gs://${bucketPath}/${imageTag}-updated.tar`;
    
    // Copy the image with the new tag
    await storage.bucket(bucketPath).file(`${imageTag}.tar`).copy(`${imageTag}-updated.tar`);

    console.log(`Image tag updated from ${imageTag} to ${imageTag}-updated in GCS.`);
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

updateImageTag();
