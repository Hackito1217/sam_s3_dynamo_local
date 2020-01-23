const AWS = require('aws-sdk')
const CSV = require('comma-separated-values')

const local = process.env.IS_LOCAL_STACK==="true"

let config = (local ? {
  region: 'ap-northeast-1',
  accessKeyId: 'fakeAccessKeyId',
  secretAccessKey: 'fakeSecretAccessKey'
} : {})
AWS.config.update(config)

const s3config = {
  endpoint: (local ? "http://localstack:4572" : undefined),
  s3ForcePathStyle: local,
  output: "csv"
}
const s3 = new AWS.S3(s3config)

const ddbconfig = {
  endpoint: (local ? "http://dynamodb:8000" : undefined)
}
const ddb = new AWS.DynamoDB.DocumentClient(ddbconfig)

exports.handler = async (event, context, callback) => {
  try {
    const params = {
      Bucket: event.Records[0].s3.bucket.name,
      Key: event.Records[0].s3.object.key
    }
    const ret = await s3.getObject(params).promise()
    console.log(ret)
    const message = ret.Body.toString()
    const csv = new CSV(message, {header: true}).parse()
    console.log(csv)

    try {
      const len = csv.length
      for (let i = 0; i < len; i++) {
        const item = {
          artist: csv[i].Artist,
          title: csv[i].Title,
          published: csv[i].Published,
          number: csv[i].Number
        }
        const prms = {
          TableName: 'cds',
          Item: item
        }
        await ddb.put(prms).promise()
        console.log("upload completed!")
      }
      const response = {
        statusCode: 200,
        body: JSON.stringify(csv)
      }
      return response
    } catch (err) {
      console.log("ddb error!", err)
      const response = {
        statusCode: 404,
        body: err
      }
      return response
    }
  } catch (err) {
    console.log(err)
    const response = {
      statusCode: 501,
      body: err
    }
    return response
  }
}