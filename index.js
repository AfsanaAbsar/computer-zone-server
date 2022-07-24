const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9irud.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}
async function run() {
    try {
        await client.connect();
        console.log('db connected');
        const productsCollection = client.db('computerZone').collection('products');
        const orderCollection = client.db('computerZone').collection('order');
        const userCollection = client.db('computerZone').collection('users');
        const reviewCollection = client.db('computerZone').collection('reviews');
        const profileCollection = client.db('computerZone').collection('profiles');
        const paymentCollection = client.db('computerZone').collection('payments');

        //admin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        }


        //load products
        app.get('/products', async (req, res) => {
            const query = {}
            const cursor = productsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        //load a single product 
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id

            const query = { _id: ObjectId(id) }
            const product = await productsCollection.findOne(query);
            res.send(product)
        })

        //update single product after order

        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedQuantity = req.body.updatedQuantity;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    quantity: updatedQuantity,

                }
            }
            console.log(updatedDoc);
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        })

        //send order details to database
        app.post('/order', async (req, res) => {
            const order = req.body;
            console.log(order);
            const query = { product: order.product, buyerEmail: order.buyerEmail }
            const exists = await orderCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, order: exists })
            }
            const result = await orderCollection.insertOne(order);
            return res.send({ success: true, result })
        });

        //display user's specific order
        app.get('/order', verifyJWT, async (req, res) => {
            const buyerEmail = req.query.buyerEmail;
            const decodedEmail = req.decoded.email;
            if (buyerEmail === decodedEmail) {
                const query = { buyerEmail: buyerEmail };
                const orders = await orderCollection.find(query).toArray();
                res.send(orders)
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        })

        //load user collection on database
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24hrs' })
            res.send({ result, token });
        })

        //load users on ui
        app.get('/user', async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })


        //make admin api
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        })

        //find admin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        //add product
        app.post('/products', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            console.log(product);
            const result = await productsCollection.insertOne(product);
            res.send(result)
        });

        //send reviews to data base
        app.post('/reviews', verifyJWT, async (req, res) => {
            const review = req.body;
            console.log(review);
            const result = await reviewCollection.insertOne(review);
            res.send(result)
        });


        //load reviews from database
        app.get('/reviews', async (req, res) => {
            const query = {}
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        // send profile info to database
        app.put('/userprofile/:email', async (req, res) => {
            const email = req.params.email;
            const profile = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: profile,
            };
            const result = await profileCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24hrs' })
            res.send({ result, token });
        })
        //load profile info on ui
        app.get('/userProfile/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }

            const cursor = profileCollection.find(query);
            const profile = await cursor.toArray();
            console.log(profile);
            res.send(profile);
        });

        //load a single order for payment

        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })

        //payment intent api
        app.post('/create-payment-intent', async (req, res) => {
            const { totalprice } = req.body;
            console.log(totalprice);
            const amount = totalprice * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        });


        //payment data send to database
        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedorder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedorder);
        })


        //cancel order data send to database
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await orderCollection.deleteOne(query);
            res.send(result)
        })


        //load all orders
        app.get('/orders', verifyJWT, async (req, res) => {
            const query = {}
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });


        //delete product
        app.delete('/products/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query);
            res.send(result)
        })

        //loading user profile

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }

            const cursor = userCollection.find(query);
            const profile = await cursor.toArray();
            console.log(profile);
            res.send(profile);
        });

    }

    finally {

    }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello computer')
})

app.listen(port, () => {
    console.log(`computer listening on port ${port}`)
})















