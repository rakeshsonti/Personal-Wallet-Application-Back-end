const express = require("express");
const app = express();
const port = 9999;
//middleware to read body
app.use(express.json());
const cors = require("cors");
app.use(
   cors({
      credentials: true,
      origin: "http://localhost:3000",
   })
);
const { Sequelize, DataTypes } = require("sequelize");
const { all } = require("sequelize/types/lib/operators");
const connectionStr = `postgres://khnssbcwsnxahq:a18827ef3b88563ef5092f0faa5124b46c91559164e2c10914240784212aaa93@ec2-50-19-247-157.compute-1.amazonaws.com:5432/dev8dm2i0dmjne
`;
const db = new Sequelize(connectionStr, {
   dialect: "postgres",
   dialectOptions: {
      ssl: {
         require: true,
         rejectUnauthorized: false,
      },
   },
});
const Personal_Wallet = db.define("personal_wallet", {
   user_id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
   },
   username: {
      type: DataTypes.STRING,
   },
   phone: {
      type: DataTypes.STRING,
      unique: true,
   },
   balance: {
      type: DataTypes.INTEGER,
   },
});
const Transactions = db.define("transactions", {
   user_id: {
      type: DataTypes.UUID,
      references: {
         model: Personal_Wallet,
         key: "user_id",
      },
   },
   transaction_type: DataTypes.STRING,
   trans_date: DataTypes.DATE,
   initial_balance: DataTypes.INTEGER,
   amount: DataTypes.INTEGER,
   final_balance: DataTypes.INTEGER,
   remarks: DataTypes.STRING,
   transaction_id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
   },
});
app.post("/user", async (req, res) => {
   const { username, phone, balance } = req.body;
   const newUser = await Personal_Wallet.create({
      username: username,
      phone: phone,
      balance: Number(balance),
   });
   // console.log("new user:", newUser);
   res.send(newUser);
});
//for testing purpose
app.get("/all", async (req, res) => {
   console.log("-------------------------aaya------------------------");
   const { name } = req.query;
   const user = await Personal_Wallet.findOne({
      where: { username: name },
      // attributes: ["balance"],
   });
   res.send(user);
});
app.get("/balance", async (req, res) => {
   const { user_id } = req.query;
   const bal = await Personal_Wallet.findOne({
      where: { user_id: user_id },
      attributes: ["balance"],
   });
   console.log(bal);
   res.send(bal);
});
app.put("/addfunds", async (req, res) => {
   const { user_id, amount } = req.body;
   let error = false;
   // console.log("type", amount);
   const str = amount.toString();
   let num_arr = str.split(".");
   const len = num_arr.length;
   let user_amount = 0;
   if (len === 1) {
      user_amount = Number(num_arr[0]) * 100;
   } else {
      //convert RS to Pese
      //if someone put 1.234 so it should show error because pese should have only two digit
      if (len === 2 && Number(num_arr[1].toString().length) <= 2) {
         //eg 1.2 means 120 pese //edge case to convert rs to pese
         if (Number(num_arr[1].toString().length) === 1) {
            num_arr[1] = Number(num_arr[1]) * 10;
         }
         user_amount = Number(num_arr[0]) * 100 + Number(num_arr[1]);
      } else {
         error = true;
      }
   }
   if (error) {
      res.status(401).send({ err: "invalid amount" });
   } else {
      //find users previous balance
      const bal = await Personal_Wallet.findOne({
         where: { user_id: user_id },
         attributes: ["balance"],
      });
      // console.log("balance -:", bal.balance);
      const final_amount = Number(user_amount) + Number(bal.balance);
      const updateUser = await Personal_Wallet.update(
         {
            balance: final_amount,
         },
         {
            where: { user_id: user_id },
         }
      );
      //update this transaction into transaction table
      const trans = await Transactions.create({
         user_id: user_id,
         transaction_type: "add_funds",
         trans_date: new Date(),
         initial_balance: Number(bal.balance),
         amount: Number(user_amount),
         final_balance: Number(final_amount),
         remarks: "Done",
      });
      // console.log("update user: ", updateUser);
      res.send({ updated: `user updated amount ${final_amount} ` });
   }
});
//--------------------------spend fund end point
app.put("/spendfunds", async (req, res) => {
   const { user_id, amount } = req.body;
   let error = false;
   // console.log("type", amount);
   const str = amount.toString();
   let num_arr = str.split(".");
   const len = num_arr.length;
   let user_amount = 0;
   if (len === 1) {
      user_amount = Number(num_arr[0]) * 100;
   } else {
      //convert RS to Pese
      //if someone put 1.234 so it should show error because pese should have only two digit
      if (len === 2 && Number(num_arr[1].toString().length) <= 2) {
         //eg 1.2 means 120 pese //edge case to convert rs to pese
         if (Number(num_arr[1].toString().length) === 1) {
            num_arr[1] = Number(num_arr[1]) * 10;
         }
         user_amount = Number(num_arr[0]) * 100 + Number(num_arr[1]);
      } else {
         error = true;
      }
   }
   if (error) {
      res.status(401).send({ err: "invalid amount" });
   } else {
      //find users previous balance
      const bal = await Personal_Wallet.findOne({
         where: { user_id: user_id },
         attributes: ["balance"],
      });
      const final_amount = Number(bal.balance) - Number(user_amount);
      if (final_amount < 0) {
         // user cannot spend more than what she has in balance
         res.status(401).send({
            err: "cannot spend more than current balance",
         });
      } else {
         const updateUser = await Personal_Wallet.update(
            {
               balance: final_amount,
            },
            {
               where: { user_id: user_id },
            }
         );
         //update this transaction into transaction table
         const trans = await Transactions.create({
            user_id: user_id,
            transaction_type: "spend_funds",
            trans_date: new Date(),
            initial_balance: Number(bal.balance),
            amount: Number(user_amount),
            final_balance: Number(final_amount),
            remarks: "Done",
         });
         res.send({ updated: `user updated amount ${final_amount} ` });
      }
   }
});

app.get("/alltransactions", async (req, res) => {
   const all_transactions = await Transactions.findAll({
      attributes: [
         "user_id",
         "trans_date",
         "amount",
         "final_balance",
         "transaction_type",
      ],
      order: [
         ["user_id", "ASC"],
         ["createdAt", "ASC"],
      ],
   });
   // console.log(all_transactions);
   res.send(all_transactions);
});
//as assignment suggest to create this end point
app.get("/transactions", async (req, res) => {
   const { user_id } = req.query;
   const user_all_transactions = await Transactions.findAll({
      attributes: [
         "user_id",
         "trans_date",
         "amount",
         "final_balance",
         "transaction_type",
      ],
      order: [
         ["user_id", "ASC"],
         ["createdAt", "ASC"],
      ],
      where: { user_id: user_id },
   });
   res.send(user_all_transactions);
});
//fetch all users wallet details and send back to the client

app.get("/allwallets", async (req, res) => {
   const all_wallets = await Personal_Wallet.findAll({
      attributes: ["user_id", "username", "phone", "balance"],
      order: [["updatedAt", "DESC"]],
   });
   console.log("alll:", all_wallets);
   res.send(all_wallets);
});
db.sync()
   .then(() => {
      app.listen(port, () => {
         console.log(`App is listening on port : ${port}...`);
      });
   })
   .catch((err) => {
      console.log("error:", err);
   });
