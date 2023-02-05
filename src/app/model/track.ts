export interface Track {
  id: string,
  href: string,
  uri: string,
  artists: Artist[]
}

export interface Artist {
  id: string,
  href: string,
  name: string,
  uri: string
}
