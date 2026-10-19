import { useState } from 'react'
import { useAtualizacao } from './useAtualizacao.js'
import './desktop.css'

const STATUS_VISIVEIS = new Set(['available', 'downloading', 'downloaded', 'error'])

/** Aviso de nova versão: mostra o download e o botão para reiniciar e instalar. */
export default function AtualizacaoBanner() {
  const { estado, instalar, verificar, temApi } = useAtualizacao()
  const [instalando, setInstalando] = useState(false)
  // Guarda o aviso de erro que foi fechado; um novo erro (novo objeto) volta a aparecer.
  const [erroFechado, setErroFechado] = useState(null)

  if (!temApi || !estado || !STATUS_VISIVEIS.has(estado.status)) return null
  const erro = estado.status === 'error'
  if (erro && erroFechado === estado) return null

  const progresso = typeof estado.progresso === 'number' ? estado.progresso : 0

  const onInstalar = async () => {
    setInstalando(true)
    const r = await instalar()
    if (!r?.ok) setInstalando(false)
  }

  return (
    <section
      className={`orb-update${erro ? ' orb-update--erro' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="orb-update__texto">
        <strong>
          {estado.status === 'downloaded' && 'Atualização pronta'}
          {estado.status === 'downloading' && 'Baixando atualização'}
          {estado.status === 'available' && 'Nova versão disponível'}
          {erro && 'Atualização indisponível'}
        </strong>
        <p>
          {instalando
            ? 'Salvando os dados e reiniciando para instalar...'
            : estado.mensagem}
        </p>
        {(estado.status === 'downloading' || estado.status === 'available') && (
          <div
            className="orb-update__progresso"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progresso}
          >
            <div className="orb-update__barra" style={{ width: `${progresso}%` }} />
          </div>
        )}
      </div>
      {estado.status === 'downloaded' && (
        <button
          type="button"
          className="orb-nav-btn orb-update__acao"
          onClick={onInstalar}
          disabled={instalando}
        >
          Reiniciar e instalar
        </button>
      )}
      {erro && (
        <>
          <button type="button" className="orb-nav-btn" onClick={verificar}>
            Tentar novamente
          </button>
          <button
            type="button"
            className="orb-nav-btn"
            onClick={() => setErroFechado(estado)}
          >
            Fechar
          </button>
        </>
      )}
    </section>
  )
}
