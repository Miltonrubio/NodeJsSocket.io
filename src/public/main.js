const socket = io();



fetch('/api/sesion')
.then(response => response.json())
.then(data => {
    // Actualizar el contenido del elemento h1 con los datos de sesión
    document.getElementById('tituloCRUD').textContent = `Usuario: ${data.usuario}`;
})
.catch(error => {
    console.error('Error al obtener los datos de sesión:', error);
});




const noteForm = document.querySelector("#formNote");
const tituloMensaje = document.querySelector("#title");
const descrip = document.querySelector("#descrip");


const contenedorNotas = document.getElementById("notes");

socket.on('chat:message', function (mensajes) {
    console.log(mensajes);
    contenedorNotas.innerHTML = ""

    mensajes.forEach(function (mensaje) {
        contenedorNotas.innerHTML += `


        <div class="card  p-2  card-content mb-2" >
        <div class="row">
        <div class=" col-9">
        <h4 class="titulo text-primary"> ${mensaje.titulo}</h4>

        <p>${mensaje.cuerpo} </p>
        </div>
        <div class=" col-3 my-auto">
        <button class="btn btn-danger " type="button"  onclick="modalEliminar( ${mensaje.ID_mensaje},'${mensaje.titulo}');"> Eliminar </button>
        <button class="btn btn-warning"  type="button"  onclick="modalEditar( ${mensaje.ID_mensaje},'${mensaje.titulo}', '${mensaje.cuerpo}' );"> Editar </button>
        </div>
        </div>
        </div>
        `;
    });
});


function modalEliminar (id, titulo){
    $('#form_eliminar')[0].reset();
    $('#modal_eliminar').modal('show');

    $('#ID_elim').val(id);
    $('#tituloMen').val(titulo);

    $('#textoEliminacion').text("Confirmación para la liminacion del mensaje " +titulo);

    
}
const formEliminar = document.querySelector("#form_eliminar");


formEliminar.addEventListener("submit", (e) => {
    e.preventDefault();

    const ID_elim = document.querySelector("#ID_elim");


    socket.emit("client:eliminarMensaje", {
        id: ID_elim.value,
    })


    $('#form_eliminar')[0].reset();

    $('#modal_eliminar').modal('hide');

});




function modalEditar(id, titulo, cuerpo) {

    $('#form_editar')[0].reset();
    $('#modal_editar').modal('show');


    $('#ID_editar').val(id);
    $('#tituloMen').val(titulo);
    $('#cuerpoMen').val(cuerpo);
}

const formEditar = document.querySelector("#form_editar");


formEditar.addEventListener("submit", (e) => {
    e.preventDefault();



    const tituloMensaje = document.querySelector("#tituloMen");
    const descrip = document.querySelector("#cuerpoMen");
    const ID_editar = document.querySelector("#ID_editar");


    socket.emit("client:editarMensaje", {
        id: ID_editar.value,
        titulo: tituloMensaje.value,
        mensaje: descrip.value,
    })


    $('#form_editar')[0].reset();

    $('#modal_editar').modal('hide');

});







noteForm.addEventListener("submit", (e) => {
    e.preventDefault();

    if (descrip.value === '' || tituloMensaje.value === '') {

        alert("No puedes tener campos vacios");

    } else {


        socket.emit("client:newMessage", {
            mensaje: descrip.value,
            titulo: tituloMensaje.value
        })


        tituloMensaje.value = '';
        descrip.value = '';

    }

});



socket.on("MensajeSubido", () => {

    console.log("Se subió el mensaje")

})