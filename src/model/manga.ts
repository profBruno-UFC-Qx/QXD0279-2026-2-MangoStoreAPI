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

const mangas: Manga[] = []

let nextId = 1

export class MangaService {
  getAll(): Manga[] {
    return mangas
  }

  getById(id: number): Manga | null {
    return mangas.find(m => m.id === id) || null
  }

  validate(input: MangaInput, id?: number): string[] {
    const errors: string[] = []

    if (input.title.trim() === '') {
      errors.push('O título é obrigatório')
    }

    if (!Number.isInteger(input.number) || input.number < 1) {
      errors.push('O volume deve ser um número inteiro maior ou igual a 1')
    } else if (mangas.some(m => m.title === input.title && m.number === input.number && m.id !== id)) {
      // Pode haver vários volumes do mesmo título, mas não o mesmo volume duas vezes
      errors.push(`O volume ${input.number} de ${input.title} já está cadastrado`)
    }

    if (!Number.isFinite(input.price) || input.price < 0.01) {
      errors.push('O preço deve ser maior ou igual a 0,01')
    }

    return errors
  }

  // Retorna a lista de erros; lista vazia significa que deu certo
  create(input: MangaInput): string[] {
    const errors = this.validate(input)
    if (errors.length === 0) {
      mangas.push({ id: nextId++, ...input })
    }
    return errors
  }

  // Retorna a lista de erros; lista vazia significa que deu certo.
  // Quem chama deve verificar antes se o manga existe (getById).
  update(id: number, input: MangaInput): string[] {
    const manga = this.getById(id)
    if (!manga) {
      return [`Manga ${id} não encontrado`]
    }

    const errors = this.validate(input, id)
    if (errors.length === 0) {
      Object.assign(manga, input)
    }
    return errors
  }

  remove(id: number): boolean {
    const index = mangas.findIndex(m => m.id === id)
    if (index === -1) {
      return false
    }
    mangas.splice(index, 1)
    return true
  }
}
