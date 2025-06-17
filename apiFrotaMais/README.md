# Node.js API - Gerenciamento de Usuários e Produtos

Este é um projeto simples de API REST para gerenciamento de produtos e usuários, desenvolvido com Node.js, Express e MongoDB. Criado como parte da disciplina de Tecnologias Emergentes no 5º semestre do curso de Engenharia de Software.

## 🚀 Tecnologias Utilizadas
- Node.js
- Express.js
- MongoDB (Mongoose)
- Dotenv
- Morgan
- HTTP Status Codes
- Bcrypt

## 📌 Como Rodar o Projeto

### 1️⃣ Clone o repositório
```sh
git clone https://github.com/arthurritzel/apiRestNode.git
cd apiRestNode
```

### 2️⃣ Instale as dependências
```sh
npm install
```

### 3️⃣ Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto e adicione:
```sh
PORT=3000
DATABASE=mongodb+srv://seu_usuario:senha@seu_cluster.mongodb.net/seu_banco
```

### 4️⃣ Inicie o servidor
O servidor rodará na porta `3000`. A API estará disponível em `http://localhost:3000/api`.

## 📌 Rotas da API

### **Produtos**

#### 1️⃣ Criar um produto (POST)
- **URL:** `POST /api/products`
- **Body:**
```json
{
  "name": "Processador",
  "price": 1000,
  "category": "Computadores",
  "stock": 5
}
```

#### 2️⃣ Listar produtos (GET)
- **URL:** `GET /api/products`
- **Query Params (opcional):**  
  - `_page`: Número da página (ex: `?page=1`)
  - `_size`: Tamanho da página (ex: `?size=10`)
  - `_sort`: Campo para ordenação (ex: `?_sort=price`)
  - `_order`: Ordem de ordenação (asc ou desc, ex: `?_order=desc`)

#### 3️⃣ Buscar um produto (GET)
- **URL:** `GET /api/products/:id`

#### 4️⃣ Atualizar um produto (PUT)
- **URL:** `PUT /api/products/:id`
- **Body:**
```json
{
  "name": "Processador",
  "price": 1000,
  "category": "Computadores",
  "stock": 8
}
```

#### 5️⃣ Deletar um produto (DELETE)
- **URL:** `DELETE /api/products/:id`

---

### **Usuários**

#### 1️⃣ Criar um usuário (POST)
- **URL:** `POST /api/users`
- **Body:**
```json
{
  "name": "Arthur Ritzel",
  "email": "ritzelarthur@email.com",
  "password": "admin"
}
```

#### 2️⃣ Listar usuários (GET)
- **URL:** `GET /api/users`
- **Query Params (opcional):**  
  - `_page`: Número da página (ex: `?page=1`)
  - `_size`: Tamanho da página (ex: `?size=10`)
    - `_sort`: Campo para ordenação (ex: `?_sort=name`)
  - `_order`: Ordem de ordenação (asc ou desc, ex: `?_order=asc`)

#### 3️⃣ Buscar um usuário (GET)
- **URL:** `GET /api/users/:id`

#### 4️⃣ Atualizar um usuário (PUT)
- **URL:** `PUT /api/users/:id`
- **Body:**
```json
{
  "name": "Arthur Ritzel",
  "email": "ritzelarthur@email.com",
  "password": "admin"
}
```

#### 5️⃣ Deletar um usuário (DELETE)
- **URL:** `DELETE /api/users/:id`

---