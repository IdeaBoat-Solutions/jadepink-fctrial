import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Start deterministic (false on the server and first client render) to avoid
  // hydration mismatch; read the real value after mount, deferred so we never
  // setState synchronously inside the effect body.
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener("change", onChange)
    const id = window.setTimeout(onChange, 0)
    return () => {
      mql.removeEventListener("change", onChange)
      window.clearTimeout(id)
    }
  }, [])

  return isMobile
}
