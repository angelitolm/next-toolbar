'use client'

export default function ClientError() {
  return (
    <button
      onClick={() => {
        setTimeout(() => {
          throw new Error('client boom')
        })
      }}
    >
      Throw client error
    </button>
  )
}
