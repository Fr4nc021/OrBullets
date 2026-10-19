import { useEffect, useState } from 'react'

const ESTADO_VAZIO = {
  status: 'idle',
  versaoAtual: '',
  versaoNova: null,
  progresso: null,
  mensagem: '',
}

/** Estado da atualização automática (só no app desktop). */
export function useAtualizacao() {
  const api = typeof window !== 'undefined' ? window.orbDesktop : null
  const temApi = Boolean(api?.atualizacaoEstado)
  const [estado, setEstado] = useState(temApi ? null : ESTADO_VAZIO)

  useEffect(() => {
    if (!api?.atualizacaoEstado) return undefined
    let ativo = true

    api
      .atualizacaoEstado()
      .then((dados) => {
        if (ativo && dados) setEstado(dados)
      })
      .catch(() => {
        if (!ativo) return
        setEstado({
          ...ESTADO_VAZIO,
          status: 'error',
          mensagem: 'Não foi possível verificar atualizações.',
        })
      })

    const cancelar = api.onAtualizacao?.((dados) => {
      if (ativo) setEstado(dados)
    })

    return () => {
      ativo = false
      if (typeof cancelar === 'function') cancelar()
    }
  }, [api])

  async function instalar() {
    if (!api?.atualizacaoInstalar) return null
    return api.atualizacaoInstalar()
  }

  async function verificar() {
    if (!api?.atualizacaoVerificar) return null
    const dados = await api.atualizacaoVerificar()
    if (dados) setEstado(dados)
    return dados
  }

  return { estado, instalar, verificar, temApi }
}
