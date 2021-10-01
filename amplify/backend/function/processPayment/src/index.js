const aws = require("aws-sdk");

var USER_POOL_ID;
var STRIPE_PRIVATE_KEY;

const { CognitoIdentityServiceProvider } = require("aws-sdk");
const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();
const stripeLib = require("stripe");

const getUserEmail = async (event) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: event.identity.claims.username,
  };
  const user = await cognitoIdentityServiceProvider
    .adminGetUser(params)
    .promise();
  const { Value: email } = user.UserAttributes.find((attr) => {
    if (attr.Name === "email") {
      return attr.Value;
    }
  });
  return email;
};

/*
 * Get the total price of the order
 * Charge the customer
 */
exports.handler = async (event) => {
  try {
    const { Parameters } = await new aws.SSM()
      .getParameters({
        Names: ["USER_POOL_ID", "STRIP_PRIVATE_KEY"].map(
          (secretName) => process.env[secretName]
        ),
        WithDecryption: true,
      })
      .promise();

    // Parameters will be of the form { Name: 'secretName', Value: 'secretValue', ... }[]
    USER_POOL_ID = Parameters[1].Value;
    STRIP_PRIVATE_KEY = Parameters[0].Value;
    const stripe = new stripeLib(STRIP_PRIVATE_KEY);

    const { id, cart, total, address, token } = event.arguments.input;
    const { username } = event.identity.claims;
    const email = await getUserEmail(event);

    await stripe.charges.create({
      amount: total * 100,
      currency: "usd",
      source: token,
      description: `Order ${new Date()} by ${username} with ${email} email`,
    });
    return { id, cart, total, address, username, email };
  } catch (err) {
    throw new Error(err);
  }
};
