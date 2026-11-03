/** Acesso ao armazenamento do navegador que nunca quebra o app (modo anônimo, dados bloqueados etc.). */
const memory = new Map<string, string>()

function make(getArea: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return getArea().getItem(key)
      } catch {
        return memory.get(key) ?? null
      }
    },
    set(key: string, value: string) {
      try {
        getArea().setItem(key, value)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'QuotaExceededError') throw err
        memory.set(key, value)
      }
    },
    remove(key: string) {
      try {
        getArea().removeItem(key)
      } catch {
        memory.delete(key)
      }
    },
  }
}

export const local = make(() => window.localStorage)
export const session = make(() => window.sessionStorage)
