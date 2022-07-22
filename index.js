const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9irud.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        console.log('db connected');
        const productsCollection = client.db('computerZone').collection('products');
        const orderCollection = client.db('computerZone').collection('order');
        const userCollection = client.db('computerZone').collection('users');


        //load services
        app.get('/products', async (req, res) => {
            const query = {}
            const cursor = productsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        //load a single service 
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id

            const query = { _id: ObjectId(id) }
            const product = await productsCollection.findOne(query);
            res.send(product)
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
        app.get('/order', async (req, res) => {
            const buyerEmail = req.query.buyerEmail;
            const query = { buyerEmail: buyerEmail };
            const orders = await orderCollection.find(query).toArray();
            res.send(orders)
        })

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