import { useEffect, useState } from 'react'

/**
 * Hook that creates an object URL for a given File (or Blob) and automatically
 * revokes the URL when the file changes or when the component unmounts.
 *
 * @param file The file or blob to create an object URL for, or null/undefined.
 * @returns The object URL string if a file is provided, or null.
 */
export function useObjectUrl(file: File | Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return url
}
