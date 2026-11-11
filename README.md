# MangaAPI — um CRUD de mangas renderizado no servidor com Express e Handlebars

Este repositório é material didático para quem estuda desenvolvimento web no backend. Ele implementa um cadastro de mangas (criar, listar, editar e remover) no estilo que dominou a web antes das SPAs: **o servidor monta o HTML completo** com uma *template engine* e o navegador só exibe o resultado. Não existe JavaScript no cliente nem API JSON. Toda interação é um link (GET) ou um formulário (POST), e cada resposta é uma página nova.

Este é o ponto de partida. Mais adiante, o mesmo backend deixa de renderizar páginas e passa a ser uma API REST, que vai substituir a instância do Strapi usada pelo frontend da loja de mangas. Por isso o modelo já segue o formato que esse frontend espera.

Ao ler o código você vai entender como uma template engine se encaixa no Express, por que um formulário HTML só sabe fazer GET e POST, como evitar o reenvio de formulários com o padrão *Post/Redirect/Get* e como separar a validação de entrada (controller) da validação de regras de negócio (serviço).

---

## 🏗️ Conceitos Explorados

Os conceitos estão na ordem em que vale a pena estudá-los: da configuração da template engine até a divisão de responsabilidades entre as camadas.

### 1. Registrando a template engine no Express

O Express não sabe gerar HTML sozinho. É preciso registrar uma engine, dizer qual extensão ela trata e em que pasta estão os templates.

```ts
app.set('view engine', 'hbs');
app.engine('hbs', engine({
  extname: '.hbs'
}));

app.set('views', path.join(__dirname, '/views'));
```

**Por que essa decisão?**
* O `view engine` define a extensão padrão, então as rotas chamam `res.render('list')` sem escrever `list.hbs` nem o caminho completo. O controller diz *qual* página quer, e a configuração decide *onde* ela está.
* O projeto usa ES Modules (`"type": "module"` no `package.json`), e neles `__dirname` não existe. Ele é reconstruído a partir de `import.meta.url`:

  ```ts
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  ```

  Um caminho relativo como `'./views'` seria resolvido a partir da pasta em que o comando foi executado, e o servidor quebraria se fosse iniciado de outro diretório.

### 2. Layout e views: a casca e o recheio

O `express-handlebars` procura por padrão o layout `views/layouts/main.hbs`. Ele tem a estrutura comum a todas as páginas (`<head>`, CSS, `<main>`), e cada view preenche só o miolo:

```hbs
  <body>
    <main>
      {{{body}}}
    </main>
  </body>
```

**Por que essa decisão?**
* Sem layout, cada view repetiria o `<!DOCTYPE>`, o `<head>` e o CSS. Mudar o estilo exigiria editar todos os arquivos.
* Repare nas **três chaves** em `{{{body}}}`. Com duas chaves (`{{title}}`) o Handlebars *escapa* o conteúdo: um título de manga como `<script>` aparece como texto e não é executado, e isso protege contra XSS. Com três chaves o HTML entra sem escape. Só o `body` usa três chaves, porque ele já é HTML gerado pelo próprio servidor. Dado que veio do usuário sempre usa duas.

### 3. Do request à página: `res.render`

Cada rota busca os dados no serviço e entrega à view um objeto de contexto. A view só lê esse objeto.

```ts
app.get('/mangas', function (_req, res) {
  res.render('list', {
    pageTitle: 'Listando Mangas',
    mangas: mangaService.getAll()
  });
});
```

```hbs
    {{#each mangas}}
    <tr>
      <td>{{ id }}</td>
      <td>{{ title }}</td>
      <td>{{ number }}</td>
      <td>{{ price }}</td>
```

**Por que essa decisão?**
* Numa SPA, o servidor devolveria JSON e um código JavaScript no navegador montaria a tabela. Aqui o servidor devolve a página pronta. O navegador não precisa executar nada, e o HTML que chega já tem o conteúdo, o que ajuda indexadores e leitores de tela.
* A view não consulta dados nem toma decisões de negócio, só percorre (`{{#each}}`) o que recebeu.
* Repare que o título da página se chama `pageTitle`, e não `title`. Dentro do `{{#each mangas}}`, `{{ title }}` é o título **do manga da linha atual**. Se a página também usasse `title`, quem lê o template teria que adivinhar a qual dos dois cada `{{title}}` se refere. O layout usa `{{pageTitle}}` no `<title>` da página.

### 4. URLs organizadas pelo recurso

Todas as rotas giram em torno do recurso `/mangas`:

| Rota | O que faz |
|---|---|
| `GET /mangas` | lista |
| `GET /mangas/new` | formulário de criação |
| `POST /mangas` | cria |
| `GET /mangas/:id/edit` | formulário de edição |
| `POST /mangas/:id` | atualiza |
| `POST /mangas/:id/delete` | remove |

```ts
app.get('/', function (_req, res) {
  res.redirect('/mangas')
})
```

**Por que essa decisão?**
* Rotas soltas como `/novo` e `/edit/:id` não dizem *o quê* está sendo criado ou editado. Com o recurso no caminho, a URL se lê como uma frase: "editar o manga 3".
* É o mesmo desenho que a API REST vai usar. Lá, `POST /mangas` continua criando. `POST /mangas/:id` vira `PUT /mangas/:id`, e `POST /mangas/:id/delete` vira `DELETE /mangas/:id`. As rotas `new` e `edit` desaparecem, porque só existem para entregar formulários HTML.

### 5. Um formulário para criar e editar

Criar e editar mostram os mesmos campos. Por isso existe um único `form.hbs`, e a rota diz para onde ele envia os dados:

```hbs
<form action="{{action}}" method="post" id="manga">
  <fieldset>
    <legend>{{pageTitle}}</legend>
```

```ts
    res.render('form', {
      pageTitle: 'Editando um manga',
      action: `/mangas/${id}`,
      manga: manga
    })
```

**Por que essa decisão?**
* Duas cópias quase iguais do formulário acabam ficando diferentes com o tempo: alguém muda um campo em uma e esquece a outra.
* Na criação, o contexto não tem `manga`, e `{{manga.title}}` simplesmente sai vazio. Na edição, os campos já aparecem preenchidos. O mesmo template atende aos dois casos sem nenhum `if`.

### 6. HTML só fala GET e POST

Um formulário HTML não envia `PUT` nem `DELETE`. Por isso a remoção é um pequeno formulário com `method="post"`, e a edição usa `POST /mangas/:id`:

```hbs
        <a class="button" href="/mangas/{{id}}/edit" aria-label="Editar manga">✏️</a>
        <form action="/mangas/{{id}}/delete" method="post" style="display: inline">
          <button type="submit" aria-label="Remover manga">🗑️</button>
        </form>
```

```ts
app.post('/mangas/:id/delete', function(req, res) {
  const id = Number(req.params.id)
  if (mangaService.remove(id)) {
    res.redirect('/mangas')
  } else {
    res.sendStatus(404)
  }
})
```

**Por que essa decisão?**
* Remover com um link (`<a href="/mangas/1/delete">`) seria um GET, e um GET não deve alterar dados. Navegadores fazem *prefetch* de links e robôs seguem links: os dois poderiam apagar mangas sem ninguém clicar.
* Daí a regra que aparece no HTML e no CSS: **um link leva a outra página (GET) e um botão envia uma ação (POST)**. O ✏️ só abre o formulário, então é um `<a>` estilizado como botão. O 🗑️ altera dados, então é um `<button>` de verdade dentro de um `<form>`.

### 7. Post/Redirect/Get

Quando o cadastro dá certo, o servidor não renderiza nenhuma página. Ele responde com um redirecionamento:

```ts
  const errors = mangaService.create(parsed.input)
  if (errors.length > 0) {
    renderForm(res, pageTitle, action, parsed.input, errors)
    return
  }

  res.redirect('/mangas')
```

**Por que essa decisão?**
* Se o POST respondesse direto com a listagem, a última requisição do navegador continuaria sendo aquele POST. Ao apertar F5, o usuário veria o aviso de "reenviar formulário?" e poderia cadastrar o manga duas vezes.
* Com o redirect (status 302), o navegador faz um novo GET para `/mangas`. Recarregar a página passa a repetir só esse GET, que é inofensivo.

### 8. Erro devolve o formulário com status 400

Quando a validação falha, não há redirect. O formulário é renderizado de novo, com as mensagens de erro e com o que o usuário digitou:

```ts
function renderForm(res: Response, pageTitle: string, action: string,
                    manga: unknown, errors: string[]) {
  res.status(400).render('form', { pageTitle, action, manga, errors })
}
```

```hbs
{{#if errors}}
  {{#each errors}}
    <p class="alert">{{this}}</p>
  {{/each}}
{{/if}}
```

**Por que essa decisão?**
* Um redirect perderia o que foi digitado, e o usuário teria que preencher tudo de novo por causa de um único campo errado.
* O status 400 diz ao cliente, mesmo sem ele ler o HTML, que a requisição foi recusada. Responder 200 com uma mensagem de erro na página engana ferramentas como o curl, testes automáticos e o próprio DevTools.

### 9. Validação em três camadas

O mesmo dado é validado em três lugares, e cada camada responde a uma pergunta diferente.

**1ª camada, o HTML.** Os atributos `required`, `min` e `step` melhoram a experiência, mas **não garantem nada**: qualquer um pode desligá-los no DevTools ou enviar a requisição com curl.

```hbs
      <input
        type="number"
        id="price"
        name="price"
        min="0.01"
        step="0.01"
        required
        value="{{manga.price}}"
      />
```

**2ª camada, o controller: a requisição está bem formada?** Num formulário tudo chega como texto. O controller verifica se cada campo existe e se pode ser convertido para o tipo certo:

```ts
function parseNumberField(value: unknown, label: string, errors: string[]): number {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`O campo ${label} deve ser preenchido`)
    return NaN
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    errors.push(`O campo ${label} deve ser um número`)
  }
  return number
}
```

**3ª camada, o serviço: os dados respeitam as regras do negócio?** O serviço recebe dados já tipados e não sabe nada de HTTP:

```ts
    if (!Number.isInteger(input.number) || input.number < 1) {
      errors.push('O volume deve ser um número inteiro maior ou igual a 1')
    } else if (mangas.some(m => m.title === input.title && m.number === input.number && m.id !== id)) {
      // Pode haver vários volumes do mesmo título, mas não o mesmo volume duas vezes
      errors.push(`O volume ${input.number} de ${input.title} já está cadastrado`)
    }
```

As rotas chamam as duas validações do servidor sempre na mesma ordem:

```ts
  const parsed = parseMangaForm(req.body)
  if (!parsed.ok) {
    renderForm(res, pageTitle, action, req.body, parsed.errors)
    return
  }

  // 2º: os dados respeitam as regras de negócio? (serviço)
  const errors = mangaService.update(id, parsed.input)
```

**Por que essa decisão?**
* Para saber em qual camada uma regra fica, pergunte: *ela continuaria valendo se o manga chegasse por uma API JSON ou por uma importação de CSV?* "Volume inteiro", "preço mínimo" e "o mesmo volume não pode ser cadastrado duas vezes" continuariam, então ficam no serviço. "O texto `abc` não é número" só existe porque o HTTP transporta texto, então fica no controller. Essa divisão é o que vai permitir trocar as páginas pela API REST sem reescrever as regras.
* A regra do volume duplicado só pode ser checada no serviço, porque é ele que tem acesso aos mangas guardados. Repare que ela olha o **par** título + volume: "One Piece" pode ter vários volumes, mas não dois volumes 1.
* O controller trata o campo vazio **antes** de converter, porque `Number('')` dá `0`, e não `NaN`. Sem esse cuidado, um preço em branco viraria preço zero.
* A sinopse pode ficar vazia, mas o campo precisa chegar. O controller aceita `''` e recusa um corpo sem `summary`. "Estar presente" é uma questão do formato da requisição; "ser obrigatório" seria uma regra do negócio, e para a sinopse essa regra não existe.
* O controller usa `typeof` em vez de confiar no tipo declarado, porque com `urlencoded({ extended: true })` um campo pode chegar como array (`title[]=a`). Além disso, no Express 5 `req.body` fica `undefined` quando a requisição não tem corpo, daí o `body?.`.
* `ParseResult` é uma *union* discriminada: `{ ok: true, input }` ou `{ ok: false, errors }`. Depois de testar `parsed.ok`, o TypeScript sabe que `parsed.input` existe. Sem esse teste, o código não compila.
* O serviço mantém o `Number.isFinite` no preço como defesa: `NaN` também é do tipo `number`, e `NaN < 0.01` dá `false`. Só a comparação deixaria passar um `NaN` vindo de outra porta de entrada.

### 10. O modelo segue o contrato do cliente

O tipo `Manga` é o mesmo que o frontend da loja já usa para ler os dados do Strapi:

```ts
// Mesmo formato do tipo usado no frontend (e do content type do Strapi),
// para que a futura API REST possa substituir o Strapi sem mudar o cliente
export type Manga = {
  id: number
  number: number
  price: number
  summary: string
  title: string
}

export type MangaInput = Omit<Manga, 'id'>
```

**Por que essa decisão?**
* O caminho óbvio seria modelar do jeito que parece mais natural no backend, com nomes em português ou um campo `volume` em vez de `number`. Mas o objetivo final é trocar o Strapi sem que o frontend perceba. Cada nome diferente seria uma tradução a mais no meio do caminho.
* `MangaInput = Omit<Manga, 'id'>` deixa explícito nos tipos que o que vem do formulário não tem `id`: quem atribui o `id` é o serviço.

### 11. IDs estáveis em vez de índices

Cada manga recebe um `id` de um contador que só cresce:

```ts
const mangas: Manga[] = []

let nextId = 1
```

```ts
      mangas.push({ id: nextId++, ...input })
```

**Por que essa decisão?**
* Usar a posição no array como identificador (`/mangas/2/edit` = terceiro item) é a escolha mais óbvia, mas ela quebra na primeira remoção: os itens seguintes mudam de posição, e um link aberto em outra aba passa a editar outro manga.
* Com o contador, um `id` nunca é reaproveitado. Depois que o manga é removido, `/mangas/1/edit` responde 404 em vez de mostrar outro manga.

### 12. Estado em memória

Os mangas ficam num array no escopo do módulo `manga.ts`, e não em um banco de dados.

**Por que essa decisão?**
* É uma simplificação de propósito: o foco aqui é o caminho request → controller → serviço → view, não a persistência. Como o serviço esconde o array atrás de `getAll`, `getById`, `create`, `update` e `remove`, trocar por um banco depois muda só `manga.ts`, sem tocar nas rotas nem nas views.
* O efeito colateral é visível: **reiniciar o servidor apaga todos os mangas**. Com `npm run dev`, qualquer arquivo salvo reinicia o servidor e zera a lista.

---

## 🛠️ Tecnologias Utilizadas

* **Express 5:** recebe as requisições, faz o roteamento (`app.get`, `app.post`) e, com o middleware `urlencoded`, transforma o corpo dos formulários em `req.body`.
* **express-handlebars:** a template engine. Junta layout, view e contexto para gerar o HTML.
* **TypeScript:** tipa o modelo (`Manga`, `MangaInput`) e o resultado da validação (`ParseResult`), com as opções estritas `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`.
* **tsx:** executa TypeScript direto, sem compilar antes. No modo `watch`, reinicia o servidor a cada alteração.

## ▶️ Como executar

Requer Node.js (testado com a versão 24).

```bash
npm install
npm run dev
```

Acesse <http://localhost:8000>. Para conferir os tipos sem executar: `npm run typecheck`.

Para ver a validação do servidor funcionando sem a ajuda do HTML, envie a requisição direto com curl:

```bash
curl -i -d "title=One Piece&number=1.5&price=abc&summary=" http://localhost:8000/mangas
```

## 📖 Como usar este repositório para estudo

* **Abra o DevTools na aba Network** e cadastre um manga. Observe o `POST /mangas` respondendo `302` e o `GET /mangas` que vem logo depois. Esse é o Post/Redirect/Get acontecendo.
* **Veja o código-fonte da página** (Ctrl+U) e compare com `list.hbs`. Repare que nenhum `{{ }}` chega ao navegador: tudo foi resolvido no servidor.
* **Cadastre um manga com o título `<b>teste</b>`** e veja que ele aparece como texto, sem negrito. Depois troque `{{ title }}` por `{{{ title }}}` em `list.hbs` e veja a diferença que o escape faz.
* **Remova os atributos `required` e `min` pelo DevTools** e envie o formulário. Observe quais erros vêm do controller e quais vêm do serviço.
* **Estude a separação entre `parseMangaForm` e `validate`:** para cada regra, tente explicar por que ela está em uma camada e não na outra.
* **Compare a tabela de rotas com a de uma API REST:** para cada rota, diga qual método e qual URL ela teria numa API, e quais rotas deixariam de existir.
* **Exercício:** troque o array por um banco de dados (SQLite, por exemplo) mexendo apenas em `manga.ts`. Se precisar mudar `index.ts`, descubra qual detalhe do armazenamento vazou para fora do serviço.

---
Desenvolvido por [Bruno Mateus](https://github.com/brunomateus) para fins didáticos.
