console.log("Conectado");

import { Server as WebSocketServer } from "socket.io";
import express from "express";
import http from "http";
import { log } from "console";


const connection = require("./bdconfig");
const session = require('express-session');





const app = express();
const httpServer = http.createServer(app);
const io = new WebSocketServer(httpServer);
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));




app.use(session({
  secret: 'secreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000
  }
}));






app.get('/cerrar-sesion', (req, res) => {
  // Destruir la sesión
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      res.send('Error al cerrar sesión');
    } else {
      res.send('Sesión cerrada');
    }
  });
});

app.use(express.static(__dirname + "/public"));


app.post('/inicio', (req, res) => {
  const { username } = req.body;
  req.session.usuario = username;
  res.redirect('/');
});

function validarSesion(req, res, next) {
  if (!req.session.usuario || req.session.usuario != '') {

    console.log("No hay sesion ")
    return res.redirect('/login.html');
  } else {
    console.log("Si hay sesion ")
    next();
  }
}




// Rutas protegidas por la validación de sesión
app.get('/', validarSesion, (req, res) => {
  res.sendFile(__dirname + "/index2.html");

});



app.get('/api/sesion', (req, res) => {
  res.json({ usuario: req.session.usuario });
});




app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//app.listen(3000)
httpServer.listen(3000);



io.on("connection", (socket) => {
  console.log("Nueva conexion");
  /*
   const mensajes = TomarMensajesDeBD();
    io.sockets.emit("chat:message", mensajes);
  */


  // Llama a la función para tomar los mensajes y maneja el resultado
  TomarMensajesDeBD()
    .then(mensajes => {
      // Haces lo que quieras con los mensajes, por ejemplo, guardarlos en una variable
      const mensajesGuardados = mensajes;
      //  console.log("Mensajes guardados:", mensajesGuardados);
      io.sockets.emit("chat:message", mensajesGuardados);
    })
    .catch(error => {
      // Maneja cualquier error que pueda ocurrir durante la consulta
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });


  socket.on("client:newMessage", (data) => {
    const titulo = data.titulo;
    const mensajeTomado = data.mensaje;

    EnviarDatosABD(titulo, mensajeTomado, socket);


  });

  socket.on("client:editarMensaje", (data) => {
    const titulo = data.titulo;
    const mensaje = data.mensaje;
    const id = data.id;

    EditarMensaje(titulo, mensaje, id)
  });




  socket.on("client:eliminarMensaje", (data) => {
    const id = data.id;

    EliminarMensaje(id)
  });



});

function EliminarMensaje(id) {
  const query = "UPDATE mensajes SET status = 0 WHERE ID_mensaje = ?";
  connection.query(query, [id], (error, results) => {
    if (error) {
      console.error("Error al ejecutar la consulta:", error);
      return;
    }
    console.log("Se elimino el mensaje");
    TomarMensajesDeBD()
      .then(mensajes => {
        // Haces lo que quieras con los mensajes, por ejemplo, guardarlos en una variable
        const mensajesGuardados = mensajes;
        //  console.log("Mensajes guardados:", mensajesGuardados);
        io.sockets.emit("chat:message", mensajesGuardados);
      })
      .catch(error => {
        // Maneja cualquier error que pueda ocurrir durante la consulta
        console.error("Error al tomar los mensajes de la base de datos:", error);
      });
  });

}





function EditarMensaje(titulo, mensaje, id) {
  const query = "UPDATE mensajes SET titulo = ?, cuerpo = ? WHERE ID_mensaje = ?";
  connection.query(query, [titulo, mensaje, id], (error, results) => {
    if (error) {
      console.error("Error al ejecutar la consulta:", error);
      return;
    }
    console.log("Se corrigio el mensaje");
    TomarMensajesDeBD()
      .then(mensajes => {
        // Haces lo que quieras con los mensajes, por ejemplo, guardarlos en una variable
        const mensajesGuardados = mensajes;
        //  console.log("Mensajes guardados:", mensajesGuardados);
        io.sockets.emit("chat:message", mensajesGuardados);
      })
      .catch(error => {
        // Maneja cualquier error que pueda ocurrir durante la consulta
        console.error("Error al tomar los mensajes de la base de datos:", error);
      });
  });

}




function EnviarDatosABD(titulo, mensajeTomado, socket) {
  const query = "INSERT INTO mensajes (titulo, cuerpo) VALUES (?, ?)";
  connection.query(query, [titulo, mensajeTomado], (error, results) => {
    if (error) {
      console.error("Error al ejecutar la consulta:", error);
      return;
    }
    console.log("Se agrego el mensaje a la bd");

    socket.emit("MensajeSubido");
  });

  TomarMensajesDeBD()
    .then(mensajes => {
      // Haces lo que quieras con los mensajes, por ejemplo, guardarlos en una variable
      const mensajesGuardados = mensajes;
      //  console.log("Mensajes guardados:", mensajesGuardados);
      io.sockets.emit("chat:message", mensajesGuardados);
    })
    .catch(error => {
      // Maneja cualquier error que pueda ocurrir durante la consulta
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });

}

function TomarMensajesDeBD() {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM mensajes WHERE status = 1";

    connection.query(query, (error, results) => {
      if (error) {
        console.error("Error al ejecutar la consulta:", error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}


console.log("Servidor en el puerto 3000");
