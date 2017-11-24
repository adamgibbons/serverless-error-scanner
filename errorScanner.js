const AWS = require('aws-sdk')
const { accessKeyId, secretAccessKey } = require('./credentials.json')

const sqs = new AWS.SQS({ accessKeyId, secretAccessKey })
const ses = new AWS.SES({ accessKeyId, secretAccessKey });

const QueueUrl = 'https://sqs.us-east-1.amazonaws.com/292747672813/error-queue.fifo'

const SQS_PARAMS = {
  QueueUrl,
  WaitTimeSeconds: 10,
  MaxNumberOfMessages: 10,
  VisibilityTimeout: 10
}

function format(list) {
  var message = 'Errored messages are in the queue. Their message IDs are:\n\n'
  message += `${list.map(i => i.messageId).join('\n\n')}`

  return message
}

const promisedMessages = new Promise(
  (resolve, reject) => {
    sqs.receiveMessage(SQS_PARAMS, (failure, success) => {
      if (failure) { reject(failure) }
      resolve(success)
    })  
  }
)

export const run = (event, context, callback) => {
  promisedMessages
    .then(success => {
      const errors = success.Messages
        .filter(message => JSON.parse(message.Body).Message === 'error')
        .map(message => { return { messageId: message.MessageId }})

      return errors
    })
    .then(errorsList => {
      const params = {
        Destination: {
          ToAddresses: ['adam.d.gibbons@gmail.com']
        },
        Message: {
          Body: {
            Text: {
              Data: format(errorsList),
              Charset: 'UTF-8'
            }
          },
          Subject: {
            Data: "Errors in the Queue",
            Charset: 'UTF-8'
          }
        },
        Source: 'adam.d.gibbons@gmail.com',
        ReplyToAddresses: ['adam.d.gibbons@gmail.com']
      }

      ses.sendEmail(params, (failure, success) => {
        if (failure) {
          return Promise.reject(failure)
        }
        callback(null, JSON.stringify(success))
      })
    })
    .catch(error => callback(error))
}
