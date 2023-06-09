const express = require("express");
const app = express();
const cors = require("cors");
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

// Middleware: 
app.use(cors());
app.use(express.json());

// Vrify JWT Token:
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // Bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


// MongoDB Setup:
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zw8zgdm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // Connect database collection:
        const userCollection = client.db("maxcoach").collection("users");

        // POST jwt token on MongoDB:
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '2h'
            });
            res.send({ token });
        })
        
        // verifyAdmin:
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // verifyInstructor:
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // GET users data from MongoDB:
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // GET users by email data from MongoDB:
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        });

        // POST users data on MongoDB:
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'User already exists' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // Update user role as admin on MongoDB:
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;    
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // Update user role as instructor on MongoDB:
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;         
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send("MaxCoach is running");
})

app.listen(port, () => {
    console.log(`MaxCoach server is running on port: ${port}`);
})