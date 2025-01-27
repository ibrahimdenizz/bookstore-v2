const aws = require("aws-sdk");

const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const documentClient = new AWS.DynamoDB.DocumentClient();

var ORDER_TABLE;
const ORDER_TYPE = "Order";
var BOOK_ORDER_TABLE;
const BOOK_ORDER_TYPE = "BookOrder";

const createOrder = async (payload) => {
  const { order_id, username, email, total } = payload;
  var params = {
    TableName: ORDER_TABLE,
    Item: {
      id: order_id,
      __typename: ORDER_TYPE,
      customer: email,
      user: username,
      total: total,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  };
  console.log(params);
  await documentClient.put(params).promise();
};

const createBookOrder = async (payload) => {
  let bookOrders = [];
  for (i = 0; i < payload.cart.length; i++) {
    const cartItem = payload.cart[i];
    bookOrders.push({
      PutRequest: {
        Item: {
          id: uuidv4(),
          __typename: BOOK_ORDER_TYPE,
          book_id: cartItem.id,
          order_id: payload.order_id,
          customer: payload.email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }
  let params = {
    RequestItems: {},
  };
  params["RequestItems"][BOOK_ORDER_TABLE] = bookOrders;
  console.log(params);
  await documentClient.batchWrite(params).promise();
};

/*
 * Get order details from processPayment lambda
 * Create an order
 * Link books to the order - Users can see the past orders and admins can view orders by user
 * Email the invoice (Will be added later)
 */
exports.handler = async (event) => {
  try {
    const { Parameters } = await new aws.SSM()
      .getParameters({
        Names: ["ORDER_TABLE_NAME", "BOOK_ORDER_TABLE_NAME"].map(
          (secretName) => process.env[secretName]
        ),
        WithDecryption: true,
      })
      .promise();

    // Parameters will be of the form { Name: 'secretName', Value: 'secretValue', ... }[]
    ORDER_TABLE = Parameters[0].Value;
    BOOK_ORDER_TABLE = Parameters[1].Value;

    let payload = event.prev.result;
    payload.order_id = uuidv4();

    // create a new order
    await createOrder(payload);

    // links books with the order
    await createBookOrder(payload);

    // Note - You may add another function to email the invoice to the user

    return "SUCCESS";
  } catch (err) {
    console.log(err);
    return new Error(err);
  }
};
