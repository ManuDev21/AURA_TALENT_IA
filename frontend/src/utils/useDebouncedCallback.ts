import { useEffect, useRef } from 'react'

/**
 * Devuelve una version "debounced" de un callback: el estado local puede
 * actualizarse al instante, pero la funcion solo se ejecuta una vez tras
 * `delay` ms sin nuevas invocaciones. Evita inundar el API mientras el
 * usuario arrastra controles deslizantes.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay = 400,
): (...args: A) => void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (...args: A) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => callbackRef.current(...args), delay)
  }
}
