# Festa na Casa: como colocar o site no ar

São duas partes, ambas de graça:

- **Firebase:** guarda as presenças, os itens, os votos e as fotos.
- **Netlify:** hospeda o site e te dá o link para mandar aos amigos.

Faça tudo pelo **computador**. Leva uns 20 minutos.

---

## Parte 1: Firebase (o banco de dados)

### 1. Criar o projeto
1. Acesse **https://console.firebase.google.com** e entre com sua conta Google.
2. Clique em **Criar um projeto** (ou "Adicionar projeto").
3. Dê o nome `festa-na-casa`, avance e **desative o Google Analytics** (não precisa).
4. Clique em **Criar projeto** e depois em **Continuar**.

### 2. Registrar o app da Web
1. Na tela inicial do projeto, clique no ícone **`</>`** (Web).
2. Apelido: `festa`. **Não** marque "Firebase Hosting". Clique em **Registrar app**.
3. Vai aparecer um código com `const firebaseConfig = { apiKey: "...", ... }`.
4. Abra o arquivo **`config.js`** (no Bloco de Notas) e substitua o bloco `firebaseConfig` pelo que apareceu, copiando de `apiKey` até `appId`.
5. No mesmo arquivo, preencha `ADMIN_EMAIL` com o seu e-mail, por exemplo `ADMIN_EMAIL = "voce@gmail.com"`, e salve.

### 3. Ativar o login
1. No menu da esquerda: **Criação > Authentication > Vamos começar**.
2. Na aba **Método de login**, ative estes dois:
   - **Anônimo**: é assim que os convidados entram, sem precisar de cadastro.
   - **E-mail/senha**: é como você entra como organizador.
3. Na aba **Users**, clique em **Adicionar usuário**, coloque **o mesmo e-mail do `config.js`** e crie uma senha. Essa é a sua senha de organizador.

### 4. Criar o banco de dados
1. No menu: **Criação > Firestore Database > Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**.
3. Escolha **Iniciar no modo de produção** e clique em **Criar**.
4. Abra a aba **Regras**, apague tudo e cole o conteúdo do arquivo **`firestore.rules`**.
5. **Importante:** na linha `request.auth.token.email == "SEU_EMAIL_AQUI@gmail.com"`, troque pelo seu e-mail.
6. Clique em **Publicar**.

---

## Parte 2: Netlify (colocar no ar)

1. Acesse **https://app.netlify.com/drop** e crie uma conta grátis (pode entrar com o Google).
2. **Arraste a pasta `festa-app` inteira** para a área indicada na página.
3. Em alguns segundos aparece um link, tipo `https://nome-aleatorio.netlify.app`.
4. Para um nome melhor: **Site configuration > Change site name**, por exemplo `festa-na-casa-2026`.
   O link vira `https://festa-na-casa-2026.netlify.app`.

> Se você mudar algum arquivo depois, entre no site na Netlify, aba **Deploys**, e arraste a pasta de novo.

### Último ajuste no Firebase
Em **Authentication > Settings > Domínios autorizados**, clique em **Adicionar domínio** e coloque o seu domínio da Netlify (ex.: `festa-na-casa-2026.netlify.app`).

---

## Parte 3: Usar

1. Abra o seu link e toque em **"Sou o organizador"** no fim da tela inicial.
2. Entre com o e-mail e a senha que você criou no passo 3.
3. No painel **Organizar**:
   - **Informações da festa:** confira e toque em **Salvar informações**.
   - **Fotos da casa:** adicione até 10 fotos.
   - **Itens para levar** e **Opções de bebida:** toque em **Criar lista sugerida** e edite como quiser.
4. Volte para a aba **Festa** e toque em **Convidar amigos** para mandar o link no WhatsApp.

### Conferir os pagamentos
Quando alguém tocar em "Já fiz o PIX", a pessoa aparece em **Organizar > Pagamentos > Conferir**. Veja no app do seu banco se o PIX caiu e toque em **Confirmar**.

---

## Dúvidas comuns

- **Os convidados precisam de conta?** Não. Basta abrir o link.
- **Trocou de celular ou limpou o navegador?** O site não reconhece mais a pessoa. Ela pode se cadastrar de novo, e você remove a entrada antiga em Pagamentos.
- **O "Demo" amarelo aparece no topo?** O `config.js` ainda está sem o `apiKey`. No modo demo, os dados ficam só no aparelho de quem está testando.
- **Custa algo?** Não. Para uma festa, o plano gratuito do Firebase e da Netlify sobra.
