import express, { urlencoded, type Response } from 'express';
import { engine } from 'express-handlebars'
import path from 'path'
import { fileURLToPath } from 'url';
import { MangaService, type MangaInput } from './model/manga.js';

const app = express();
const PORT = 8000;

app.use(urlencoded({ extended: true }))

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mangaService = new MangaService()

app.set('view engine', 'hbs');
app.engine('hbs', engine({
  extname: '.hbs'
}));

app.set('views', path.join(__dirname, '/views'));

type ParseResult =
  | { ok: true, input: MangaInput }
  | { ok: false, errors: string[] }

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

function parseMangaForm(body: Record<string, unknown> | undefined): ParseResult {
  const errors: string[] = []

  const title = body?.title
  if (typeof title !== 'string') {
    errors.push('O campo título deve ser enviado')
  }
  // A sinopse pode ficar em branco, mas o campo precisa vir no formulário
  const summary = body?.summary
  if (typeof summary !== 'string') {
    errors.push('O campo sinopse deve ser enviado')
  }
  const number = parseNumberField(body?.number, 'volume', errors)
  const price = parseNumberField(body?.price, 'preço', errors)

  if (errors.length > 0 || typeof title !== 'string' || typeof summary !== 'string') {
    return { ok: false, errors }
  }
  return {
    ok: true,
    input: { title: title.trim(), number, price, summary: summary.trim() }
  }
}

function renderForm(res: Response, pageTitle: string, action: string,
                    manga: unknown, errors: string[]) {
  res.status(400).render('form', { pageTitle, action, manga, errors })
}

app.get('/', function (_req, res) {
  res.redirect('/mangas')
})

app.get('/mangas', function (_req, res) {
  res.render('list', {
    pageTitle: 'Listando Mangas',
    mangas: mangaService.getAll()
  });
});

app.get('/mangas/new', function(_req, res) {
  res.render('form', {
    pageTitle: 'Adicionando um novo manga',
    action: '/mangas'
  })
})

app.post('/mangas', function(req, res) {
  const pageTitle = 'Adicionando um novo manga'
  const action = '/mangas'

  const parsed = parseMangaForm(req.body)
  if (!parsed.ok) {
    renderForm(res, pageTitle, action, req.body, parsed.errors)
    return
  }

  const errors = mangaService.create(parsed.input)
  if (errors.length > 0) {
    renderForm(res, pageTitle, action, parsed.input, errors)
    return
  }

  res.redirect('/mangas')
})

app.get('/mangas/:id/edit', function(req, res) {
  const id = Number(req.params.id)

  const manga = mangaService.getById(id)
  if(manga) {
    res.render('form', {
      pageTitle: 'Editando um manga',
      action: `/mangas/${id}`,
      manga: manga
    })
  } else {
    res.sendStatus(404)
  }
})

app.post('/mangas/:id', function(req, res) {
  const id = Number(req.params.id)
  const pageTitle = 'Editando um manga'
  const action = `/mangas/${id}`

  if (!mangaService.getById(id)) {
    res.sendStatus(404)
    return
  }

  const parsed = parseMangaForm(req.body)
  if (!parsed.ok) {
    renderForm(res, pageTitle, action, req.body, parsed.errors)
    return
  }

  // 2º: os dados respeitam as regras de negócio? (serviço)
  const errors = mangaService.update(id, parsed.input)
  if (errors.length > 0) {
    renderForm(res, pageTitle, action, parsed.input, errors)
    return
  }

  res.redirect('/mangas')
})

app.post('/mangas/:id/delete', function(req, res) {
  const id = Number(req.params.id)
  if (mangaService.remove(id)) {
    res.redirect('/mangas')
  } else {
    res.sendStatus(404)
  }
})

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});