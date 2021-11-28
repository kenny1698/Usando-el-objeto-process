const express = require('express')
const { Server: HttpServer } = require('http')
const { Server: IOServer } = require('socket.io')
const moment = require('moment'); 
const { optionsMySQL } = require( './options/DBs.js')
const { optionsSQLite } = require( './options/DBs.js')
const Contenedor = require('./src/contenedores/Contenedor.js');
const { json } = require('express');
const ApiProductosMock = require('./mocks/api/productos.js')
const handlebars = require('express-handlebars');
const { normalize, schema } = require("normalizr");

const contChat = new Contenedor(optionsSQLite)
const contProd = new Contenedor(optionsMySQL)

const fecha = moment().format("DD/MM/YYYY HH:mm:ss"); 

const passport = require('passport')
const { Strategy: LocalStrategy } = require('passport-local')
const session = require('express-session')
const mongoose = require('mongoose')
const flash = require('connect-flash')
const dotenv = require('dotenv')
const { fork } = require('child_process')
const path = require('path')

dotenv.config()

const secretmongo = process.env.secretMongo
const mongodb = process.env.mongoDB

const yargs = require('yargs/yargs')(process.argv.slice(2))
const args = yargs
  .default({
    puerto: 8080
  })
 .argv
 //--puerto 8081

//console.log(args[PORT], options);

const User = require('./models/User')

const {
  createHash,
  isValidPassword
} = require('./utils')

const app = express()

mongoose.connect(mongodb)
//app.use(express.urlencoded())
app.use(session({ secret: secretmongo , 
                        resave: false, 
                        saveUninitialized:false, 
                        cookie: { maxAge: 600000 }}))
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

const { Router } = express
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const httpServer = new HttpServer(app)
const io = new IOServer(httpServer)

app.use(express.urlencoded({ extended: true }))

app.engine(
    "hbs",
    handlebars({
        extname: ".hbs",
        defaultLayout: "index.hbs",
        layoutsDir: __dirname + "/public/views/layouts",
        partialsDir: __dirname + "/public/views/partials"
    })
);

app.set('views', './public/views'); // especifica el directorio de vistas
app.set('view engine', 'hbs'); // registra el motor de plantillas



const productos = []
const mensajes = []

//contChat.start()
//contProd.start()



contProd.getAll('productos')
    .then((result) =>{
        for (const obj in result) {
            productos.push(result[obj])
            }        
    })
    .catch((err) => { console.log(err); throw err })
    .finally(() => {
        //contProd.close()
    })

// console.log(productos)

contChat.getAll('chat')
     .then((result) =>{
        for (const obj in result) {
            mensajes.push(result[obj])
            }    
     })
    .catch((err) => { console.log(err); throw err })
    .finally(() => {
        //contProd.close()
    })

const ApiProductos = new ApiProductosMock()
const productosFakes = ApiProductos.listar()


app.get('/api/productos-test', (req, res) => {
    res.render('tabla-productos', {productosFakes});
    
})

passport.use('login', new LocalStrategy(
    (username, password, done) => {
      return User.findOne({ username })
        .then(user => {
          if (!user) {
            return done(null, false, { message: 'Usuario de usuario incorrecto' })
          }
  
          if (!isValidPassword(user.password, password)) {
            return done(null, false, { message: 'Contraseña incorrecta' })
          }
  
          return done(null, user)
        })
        .catch(err => {
          return done(err)
        })
    }
  ))
  
  passport.serializeUser((user, done) => {
    done(null, user)
  })
  
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
      done(err, user)
    })
  })
  
  passport.use('register', new LocalStrategy({
    passReqToCallback: true
  }, (req, username, password, done) => {
    return User.findOne({ username })
      .then(user => {
        if (user) {
          return done(null, false, { message: 'El usuario de usuario ya existe' })
        }
  
        let newUser = new User()
        newUser.password = createHash(password)
        newUser.username = req.body.username
        return newUser.save()
      })
      .then(user => {
        return done(null, user)
      })
      .catch(err => {
        return done(err)
      })
  }))
  
  app.get('/login', (req, res) => {
    //return res.render('login', { message: req.flash('error') })
    return res.render('login')
  })

  app.get('/faillogin', (req, res) => {
    return res.render('faillogin', { message: req.flash('error') })
  })

  app.get('/failregister', (req, res) => {
    return res.render('failregister', { message: req.flash('error') })
  })
  
  app.post('/login', 
    passport.authenticate('login', { successRedirect: '/',
                                     failureRedirect: '/faillogin',
                                     failureFlash: true }))
  
  app.get('/register', (req, res) => {
    return res.render('register')
  })
  
  app.post('/register', 
    passport.authenticate('register', { successRedirect: '/',
                                     failureRedirect: '/failregister',
                                     failureFlash: true }))
  
  
  app.get('/', (req, res, next) => {
    if (req.isAuthenticated()) {
      return next()
    }
    
    return res.redirect('/login')
  }, (req, res) => {
    const nombreSesion = req.user.username
    req.session.username = nombreSesion
    return res.render('index', {nombreSesion})
  })


// app.get('/login', (req, res) => {
   
//         //req.session.contador = 1
//         res.render('login')
// })

// app.post('/login', (req, res) => {
//     //console.log("POST")
//     //console.log(req.body.nombre)
//     //req.session.contador = 1
//     req.session.nombre = req.body.nombre
//     const nombreSesion = req.session.nombre
//     res.render('index',{nombreSesion}) 
// })

app.post('/logout', (req, res) => {
    const nombreSesion = req.user.username
    req.session.destroy(err => {
        if (!err) //res.send('Logout ok!') 
        res.render('logout', {nombreSesion}) 
        else res.send({ status: 'Logout ERROR', body: err })
    })
    console.log(req.session)
    //return res.render('logout', {nombreSesion})      
})

app.get('/info', (req, res, next) => {
  
  const salida ="Argumentos de entrada: " + args + "<br>" +
                "Nombre de la plataforma: " + process.platform + "<br>" +
                "Version de node.js: " + process.version + "<br>" +
                "Memoria total reservada (rss): " + process.memoryUsage().rss + "<br>" +
                "Path de ejecucion: " + process.execPath + "<br>" +
                "Id del proceso: " + process.pid + "<br>" +
                "Carpeta del proyecto: " + process.cwd()
  return res.send(salida)
})

app.get('/api/randoms', (req, res) => {
  const cant = req.query.cant
  const computo = fork(path.resolve(__dirname, 'computo.js'))
  if (cant != undefined)
    computo.send(cant)
  else
    computo.send(100000000)
  //computo.send('start')
  computo.on('message', resultado => {
      res.json({ resultado })
      //console.log(resultado.length)
  })
})

app.use(express.static('public'));

io.on('connection',async socket => {
    console.log('Nuevo cliente conectado!')

    /* Envio los mensajes al cliente que se conectó */
    const chatMensajes = {id:'mensajes', mensajes:mensajes}
    // const chatMensajes = {
    //     id: 'mensajes',
    //     mensajes: [{
    //             id: 1,
    //             fecha: '02/11/2021 11:13:26',
    //             author: {email:"d@s",nombre:"Daniel",apellido:"Sanchez",alias:"Dani",avatar:"avatar1"},
    //             text: 'Hola'
    //         },
    //         {
    //             id: 2,
    //             fecha: '02/11/2021 11:13:26',
    //             author: {email:"d@s",nombre:"Daniel",apellido:"Sanchez",alias:"Dani",avatar:"avatar1"},
    //             text: 'Chau'
    //         }
    //     ]
    // }

    const authorSchema = new schema.Entity('authors');
    const chatSchema = new schema.Entity('chat', {
    author: authorSchema,
    });

    const normalizedChat= normalize(chatMensajes, chatSchema)
    //console.log(JSON.stringify(normalizedChat))
    //console.log(JSON.stringify(normalizedChat).length)

    socket.emit('mensajes', normalizedChat)
    //console.log(chatMensajes)
    //console.log(JSON.stringify(chatMensajes).length)

    // /* Escucho los mensajes enviado por el cliente y se los propago a todos */
    
    socket.on('mensaje',  data =>  {
        try {
            //console.log(JSON.stringify(data.author))
            const msj = {fecha, author: JSON.stringify(data.author), text:data.text}
            mensajes.push(msj)
            io.sockets.emit('mensajes', mensajes) 
            //console.log(msj)
            contChat.save(msj, 'chat')
            .then(() => {
               return 
            })
            .catch((err) => { console.log(err); throw err })
            .finally(() => {
                //contProd.close()
            })
        } catch(err) {
            console.log(err)  
        }
    })

    socket.emit('productos', productos)
    //socket.emit('productos', productos)

    socket.on('producto', data => {
        try {
            productos.push(data)
            io.sockets.emit('productos', productos)
            contProd.save([data], 'productos')
            .then(() => {
               return 
            })
            .catch((err) => { console.log(err); throw err })
            .finally(() => {
                //contProd.close()
            })
            
        } catch(err) {
            console.log(err)  
        }
       
    })
    
})

const PORT = args.puerto
const connectedServer = httpServer.listen(PORT, function () {
    console.log(`Servidor Http con Websockets escuchando en el puerto ${connectedServer.address().port}`)
})
connectedServer.on('error', error => console.log(`Error en servidor ${error}`))