const chromium = require('chrome-aws-lambda');
const AWS = require('aws-sdk');
const BUCKET_NAME = "screenshot-buckets-test";
AWS.config.region = 'eu-central-1';

exports.main = async (event, context, callback) => {
  console.info("Request Event:", event);
  let browser = null;
  let responseBody = {};
  let bucketDomain = "https://screenshot-buckets-test.s3.eu-central-1.amazonaws.com/";
  let imageUniqueName;
  const parsed_body = JSON.parse(event.body);
  const PAGE_URL = parsed_body.page_url;
  
  try {
    console.info("Puppeteer start");
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    let page = await browser.newPage();
    await page.goto(PAGE_URL);

    let image_response = await page.screenshot();
    console.info("Screenshot Buffer:", image_response);

    imageUniqueName = `${parsed_body.image_name}_${(new Date().getTime()).toString(36)}.png`;
    await putObjectToS3(imageUniqueName,image_response);

    let full_image_url = bucketDomain + imageUniqueName;
    responseBody = { ...responseBody, image_url:full_image_url }
    console.info("Response body:", responseBody);
  } catch (error) {
    return callback(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
  return callback(null,{
    statusCode: 200,
    body: JSON.stringify(responseBody)  
  });
};

const putObjectToS3 = async(key, data) => {
  console.info("Starting PutObject S3");
  let s3Bucket = new AWS.S3();
  let params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: data,
      ContentEncoding: 'base64',
      ContentType: 'image/jpeg',
      ACL: 'public-read'
  }
  console.info("S3 Parameters: ", params);
  return await new Promise((resolve, reject) => {
      s3Bucket.putObject(params, (err, data) => {
          if (err) {
              console.info("S3 PutObject Error:", err, err.stack);
              reject(error);
          }
          else {
              console.info("S3 PutObject successfull. Information:", data);
              resolve(data);
          }
      });
  });

}
