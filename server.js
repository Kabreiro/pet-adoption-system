const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"))); // Diretório correto
app.use(
  session({
    secret: "chave-secreta",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 }, 
  })
);

// Função para ler dados de arquivos JSON
const readData = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Erro ao ler o arquivo ${filePath}:`, error);
    return [];
  }
};

// Função para salvar dados em arquivos JSON
const writeData = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Erro ao salvar o arquivo ${filePath}:`, error);
  }
};

// Função para montar o caminho para os arquivos JSON
const getDataPath = (fileName) => path.join(__dirname, "data", fileName);

// Página de login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/html/login.html"));
});

// Processar login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Usuário fixo para autenticação
  if (username === "admin" && password === "1234") {
    req.session.loggedIn = true;
    
    // Formatar data e hora no padrão brasileiro (24h)
    const now = new Date();
    const formattedDate = now.toLocaleString("pt-BR", { 
      hour12: false, 
      timeZone: "America/Sao_Paulo" 
    });
    
    res.cookie("lastAccess", formattedDate);
    return res.redirect("/menu");
  }

  res.status(401).send("Usuário ou senha inválidos! <a href='/'>Tentar novamente</a>");
});


// Página do Menu
app.get("/menu", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  const lastAccess = req.cookies.lastAccess || "Primeiro acesso";

  res.send(`
    <html>
      <head>
      <link rel="stylesheet" href="/css/styles.css">
      <title>Menu</title>
      </head>
      <body>
      <div class="menu-container">
      <h1 class="a">Menu Principal</h1>
      <p class="a">Último acesso: ${lastAccess}</p>
      <ul class="menu-list">
        <li><a href="/interestedForm">Cadastrar Interessado</a></li>
        <li><a href="/petForm">Cadastrar Pet</a></li>
        <li><a href="/adoptionForm">Adotar um Pet</a></li>
        <li><a href="/interestedList" class="list-link">Lista de Interessados</a></li>
        <li><a href="/petList" class="list-link">Lista de Pets</a></li>
        <li><a href="/adoptionList" class="list-link">Lista de Adoções</a></li>
      </ul>
      <a class="a logout-link" href="/logout">Sair</a>
    </div>
      </body>
    </html>
  `);
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Formulário de cadastro de interessado
app.get("/interestedForm", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  res.sendFile(path.join(__dirname, "public/html/interestedForm.html"));
});

// Processar cadastro de interessado
app.post("/interestedForm", (req, res) => {
  let { name, email, phone } = req.body;  // Alterado para let

  // Verificar se todos os campos estão preenchidos
  if (!name || !email || !phone) {
    return res.status(400).send("Todos os campos são obrigatórios! <a href='/interestedForm'>Voltar</a>");
  }

  // Validar o número de telefone no formato esperado (com ou sem parênteses)
  const phoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-\d{4}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).send("O número de telefone informado é inválido! <a href='/interestedForm'>Voltar</a>");
  }

  // Remover tudo o que não for número
  phone = phone.replace(/\D/g, '');

  // Validar se o número de telefone tem o comprimento correto (10 ou 11 dígitos)
  if (phone.length !== 11 && phone.length !== 10) {
    return res.status(400).send("O número de telefone informado é inválido! <a href='/interestedForm'>Voltar</a>");
  }

  // Verificar se o e-mail já está cadastrado
  let users = readData(getDataPath("users.json"));
  if (users.some(user => user.email === email)) {
    return res.status(400).send("E-mail já cadastrado! <a href='/interestedForm'>Voltar</a>");
  }

  // Adicionar o novo interessado
  users.push({ name, email, phone });
  writeData(getDataPath("users.json"), users);

  res.redirect("/interestedList");
});

// Lista de Interessados
app.get("/interestedList", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  const users = readData(getDataPath("users.json"));
  let userList = `
    <html>
      <head>
      <link rel="stylesheet" href="/css/styles.css">
      <title>Lista de Interessados</title>
      </head>
      <body>
      <div class="container">
        <h1 class="a">Lista de Interessados</h1>
        <ul>
          ${users.map(user => `<li>${user.name} - ${user.email} - ${user.phone}</li>`).join("")}
        </ul>
        <a class="a" href="/menu">Voltar ao Menu</a>
        </div>
      </body>
    </html>
  `;
  res.send(userList);
});

// Formulário de cadastro de pet
app.get("/petForm", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  res.sendFile(path.join(__dirname, "public/html/petForm.html"));
});

// Processar cadastro de pet
app.post("/petForm", (req, res) => {
  const { name, breed, age } = req.body;

  if (!name || !breed || !age) {
    return res.status(400).send("Todos os campos são obrigatórios! <a href='/petForm'>Voltar</a>");
  }

  let pets = readData(getDataPath("pets.json"));

  // Verificar se já existe um pet com o mesmo nome
  if (pets.some(pet => pet.name === name)) {
    return res.status(400).send("Já existe um pet com este nome! <a href='/petForm'>Voltar</a>");
  }

  // Adicionar o novo pet, com 'adopted' como false
  pets.push({ name, breed, age, adopted: false });  // Aqui garantimos que o campo 'adopted' é false

  // Salvar a lista de pets
  writeData(getDataPath("pets.json"), pets);

  res.redirect("/petList");
});

// Lista de Pets
app.get("/petList", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  const pets = readData(getDataPath("pets.json"));
  let petList = `
    <html>
      <head>
      <link rel="stylesheet" href="/css/styles.css">
      <title>Lista de Pets</title>
      </head>
      <body>
      <div class="container">
        <h1 class="a">Lista de Pets</h1>
        <ul>
          ${pets.map(pet => `<li>${pet.name} - ${pet.breed} - ${pet.age} anos</li>`).join("")}
        </ul>
        <a class="a" href="/menu">Voltar ao Menu</a>
        </div>
      </body>
    </html>
  `;
  res.send(petList);
});

// Formulário de adoção
app.get("/adoptionForm", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  // Lê os dados de interessados e pets disponíveis
  const users = readData(path.join(__dirname, "data/users.json"));
  const pets = readData(path.join(__dirname, "data/pets.json")).filter(pet => !pet.adopted);

  // Gerar o formulário de adoção com as opções de interessados e pets
  let adoptionForm = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="/css/styles.css">
      <title>Adoção de Pets</title>
    </head>
    <body>
      <div class="container">
        <h1>Adoção de Pet</h1>
        <form action="/adoptionForm" method="POST">
          <label for="interested">Interessado:</label>
          <select name="interested" required>
            ${users.map(user => `<option value="${user.name}">${user.name}</option>`).join("")}
          </select>

          <label for="pet">Pet:</label>
          <select name="pet" required>
            ${pets.map(pet => `<option value="${pet.name}">${pet.name}</option>`).join("")}
          </select>

          <button type="submit">Manifestar Interesse</button>
        </form>
        <a class="a" href="/menu">Voltar ao Menu</a>
      </div>
    </body>
    </html>
  `;

  res.send(adoptionForm);
});

// Processar adoção
app.post("/adoptionForm", (req, res) => {
  const { interested, pet } = req.body;

  const users = readData(path.join(__dirname, "data/users.json"));
  const pets = readData(path.join(__dirname, "data/pets.json"));
  const adoptions = readData(path.join(__dirname, "data/adoptions.json"));

  // Encontrar o interessado pelo nome
  const interestedPerson = users.find(user => user.name === interested);
  
  // Verificar se o interessado foi encontrado
  if (!interestedPerson) {
    return res.status(400).send("Interessado não encontrado! <a href='/adoptionForm'>Voltar</a>");
  }

  // Encontrar o pet selecionado
  const petToAdopt = pets.find(petObj => petObj.name === pet);

  // Verificar se o pet foi encontrado
  if (!petToAdopt) {
    return res.status(400).send("Pet não encontrado! <a href='/adoptionForm'>Voltar</a>");
  }

  // Verificar se o pet já foi adotado
  if (petToAdopt.adopted) {
    return res.status(400).send("Este pet já foi adotado! <a href='/adoptionForm'>Voltar</a>");
  }

  // Registrar a adoção no histórico
  adoptions.push({ interested: interestedPerson, pet: petToAdopt, date: new Date().toLocaleString() });

  // Marcar o pet como adotado
  petToAdopt.adopted = true;

  // Salvar as mudanças no arquivo de adoções e pets
  writeData(path.join(__dirname, "data/adoptions.json"), adoptions);
  writeData(path.join(__dirname, "data/pets.json"), pets);

  // Redirecionar para a lista de adoções após a adoção ser concluída
  res.redirect("/adoptionList");
});


// Lista de Adoções
app.get("/adoptionList", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  // Lê os dados de adoções
  const adoptions = readData(path.join(__dirname, "data/adoptions.json"));
  
  // Gerar o HTML com as adoções
  let adoptionList = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="/css/styles.css">
      <title>Lista de Adoções</title>
    </head>
    <body>
      <div class="list-container">
        <h1 class="a">Lista de Adoções</h1>
        <ul>
          ${adoptions.map(adopt => `<li>${adopt.interested.name} Registrou Interesse na adoção do pet: ${adopt.pet.name} em ${adopt.date}</li>`).join("")}
        </ul>
        <a class="a" href="/menu">Voltar ao Menu</a>
      </div>
    </body>
    </html>
  `;
  
  res.send(adoptionList);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
