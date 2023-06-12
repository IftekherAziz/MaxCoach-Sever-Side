const express = require("express");
const app = express();
const cors = require("cors");
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// Middleware: 
app.use(cors());
app.use(express.json());

// Vrify JWT Token:
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized Access ami' });
    }
    // Bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized Access tumi' })
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
        // await client.connect();

        // Create database collection:
        const userCollection = client.db("maxcoach").collection("users");
        const classesCollection = client.db("maxcoach").collection("classes");
        const cartCollection = client.db("maxcoach").collection("carts");
        const paymentCollection = client.db("maxcoach").collection("payments");
        const contactCollection = client.db("maxcoach").collection("contact");
        // POST jwt token on MongoDB:
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            });
            res.send({ token });
        })

        // verifyAdmin:
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'Forbidden Access' });
            }
            next();
        }

        // verifyInstructor:
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'Forbidden Access' });
            }
            next();
        }

        // GET users data from MongoDB:
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // GET user by email data from MongoDB:
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
        app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
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
        app.patch('/users/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
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

        // GET all instructor data from MongoDB:
        app.get('/instructors', async (req, res) => {
            const result = await userCollection.find({ role: 'instructor' }).toArray();
            res.send(result);
        })


        // GET all approved classes data from MongoDB:
        app.get('/viewClasses', async (req, res) => {
            const result = await classesCollection.find({ status: 'approved' }).toArray();
            res.send(result);
        })

        // GET all popular classes data from MongoDB:
        app.get('/classes/popular', async (req, res) => {
            const popularClasses = await classesCollection.find({ status: 'approved' }).sort({ 'enrolled_students': -1 }).limit(6).toArray();
            res.json(popularClasses);

        });

        // GET all classes data from MongoDB:
        app.get('/classes', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        // GET classes added by an instructor based on email
        app.get('/classes/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.params.email;
            const classes = await classesCollection.find({ instructorEmail: email }).toArray();
            res.send(classes);
        });

        // POST a class data on MongoDB:
        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const newItem = req.body;
            const result = await classesCollection.insertOne(newItem);
            res.send(result);
        })

        // PATCH a class status approval based on class id data on MongoDB:
        app.patch('/classes/approve/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // PATCH a class status denied based on class id data on MongoDB:
        app.patch('/classes/deny/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // PATCH a class feedback based on class id data on MongoDB:
        app.patch('/classes/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { feedback } = req.body;

            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        feedback: feedback
                    },
                };
                const result = await classesCollection.updateOne(filter, updateDoc);
                res.json(result);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'An error occurred while updating the feedback.' });
            }
        });

        // GET all classes carts data  from MongoDB:
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        // GET a class data cart from MongoDB:
        app.get('/carts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.findOne(query);
            res.send(result);
        })


        // POST a class data cart on MongoDB:
        app.post('/carts', verifyJWT, async (req, res) => {
            const selectedClass = req.body;
            console.log(selectedClass);
            const result = await cartCollection.insertOne(selectedClass);
            res.send(result);
        })

        // DELETE a class data from cart on MongoDB:
        app.delete('/carts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // Create payment intent for stripe payment:
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //  
        app.get('/payment/:email',  verifyJWT,
         async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        // POST payment data on MongoDB:
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            cart_id = payment.cart_id;
            user_id = payment.user_id;
            selectedClassId = payment.selectedClassId;

            // add in payment collection
            const addedResult = await paymentCollection.insertOne(payment);

            // delete in data from selected classes
            const filter = { _id: new ObjectId(cart_id) };
            const deletedResult = await cartCollection.deleteOne(filter);

            // update enrolled students in class collection
            const updateFilter = { _id: new ObjectId(selectedClassId) };
            const update = {
                $inc: {
                    enrolled_students: 1
                }
            };
            const addingResult = await classesCollection.updateOne(updateFilter, update);
            res.send({ result: addedResult, deletedResult, addingResult })


        })

        // POST contact form data to MongoDB
        app.post('/contact', async (req, res) => {
            const contact = req.body;      
            const result = await contactCollection.insertOne(contact);
            res.send(result);
        });


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