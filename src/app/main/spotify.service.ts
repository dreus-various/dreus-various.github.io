import {Injectable} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {catchError, delay, firstValueFrom, map, Observable, of, tap} from "rxjs";
import {HttpClient} from "@angular/common/http";

@Injectable({providedIn: 'root'})
export class SpotifyService {

  private userId: string = '';

  private tracksCache: { id: string, uri: string }[] = [];

  private cacheCache = new Map<string, any>();
  private artistCache = new Map<string, any>();

  constructor(private cookieService: CookieService, private http: HttpClient) {
  }

  public clearCache() {
    this.tracksCache = [];
  }

  public async getPlaylistByName(name: string): Promise<any | null> {
    let offset = 0;
    let playlists = await this.getPlaylists(offset);

    let found = playlists.items.find((item: { name: string }) => item.name === name) ?? null;

    while (!found && playlists.items.length !== 0) {
      offset += 50;
      playlists = await this.getPlaylists(offset);
      found = playlists.items.find((item: { name: string }) => item.name === name) ?? null;
    }
    return found;
  }

  // public getPlaylistByName(name: string): Observable<any | null> {
  //   return this.getPlaylists().pipe(
  //     map(res => res.items),
  //     map((items: any[]) => items.filter(item => item.name === name)),
  //     map(items => items.length > 0 ? items[0] : null)
  //   )
  // }

  public getPlaylists(offset: number): Promise<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/me/playlists?offset=${offset}&limit=50`;

    return firstValueFrom(
      this.http.get(url, {
        headers: {
          Authorization: 'Bearer ' + token
        }
      })
    );
  }

  // public getPlaylists(offset: number): Observable<any> {
  //   const token = this.cookieService.get('spotify_token');
  //   const url = `https://api.spotify.com/v1/me/playlists&offset=${offset}`;
  //
  //   return this.http.get(url, {
  //     headers: {
  //       Authorization: 'Bearer ' + token
  //     }
  //   })
  // }

  public getPlaylist(id: string): Promise<any | null> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/playlists/${id}`;

    return firstValueFrom(
      this.http.get(url, {headers: {Authorization: 'Bearer ' + token}}).pipe(
        catchError(err => {
          console.log('getPlaylist error');
          return of(null);
        }),
        delay(10),
      )
    )
  }

  public getPlaylistTracks(id: string, offset: number): Promise<any | null> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/playlists/${id}/tracks?offset=${offset}&limit=100`;

    return firstValueFrom(
      this.http.get(url, {headers: {Authorization: 'Bearer ' + token}}).pipe(
        catchError(err => {
          console.log('getPlaylistTracks error');
          return of(null);
        }),
        delay(10),
      )
    );
  }

  public addToPlaylist(id: string, uris: string[]): Promise<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/playlists/${id}/tracks`;

    return firstValueFrom(
      this.http.post(url, {
        uris,
        position: 0
      }, {headers: {Authorization: 'Bearer ' + token}})
    )
  }

  public getUserInfo(): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = 'https://api.spotify.com/v1/me'
    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}})
  }

  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public getUserId(): string {
    return this.userId;
  }

  public saveNewPlaylist(name: string, description: string): Promise<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/users/${this.userId}/playlists`;

    return firstValueFrom(this.http.post(url, {
      'public': false,
      name,
      description
    }, {headers: {Authorization: 'Bearer ' + token}}))
  }

  public async deleteAllSong(playlist: any): Promise<any> {
    let playlistInfo: any = await this.getPlaylist(playlist.id);
    while (playlistInfo.tracks.items.length > 0) {
      await firstValueFrom(this.deleteTracksFromPlaylist(playlist.id, playlistInfo.tracks.items.map((item: any) => ({uri: item.track.uri}))));
      playlistInfo = await this.getPlaylist(playlist.id);
    }
    return playlist;
  }

  public deleteTracksFromPlaylist(id: string, songs: { uri: string }[]) {
    if (songs.length === 0) {
      return of(id);
    }

    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/playlists/${id}/tracks`;

    return this.http.delete(url, {
      headers: {Authorization: 'Bearer ' + token},
      body: {tracks: [...songs]}
    })
  }

  public getTotalUserTracks(): Observable<number> {
    return this.getUserTracks(0, 1).pipe(
      map(res => res.total)
    )
  }

  public getUserTracks(offset: number, limit: number): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}&market=NL`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}}).pipe(
      delay(100)
    )
  }

  public addPlayback(playlistUri: string): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/me/player/play`;

    return this.http.put(url, {
      context_uri: playlistUri,
      offset: {
        position: 0
      },
      position_ms: 0
    }, {headers: {Authorization: 'Bearer ' + token}});
  }

  public getTrackInfo(trackId: string): Observable<any | null> {
    if (this.cacheCache.has(trackId)) {
      console.log('got from cache!');
      return of(this.cacheCache.get(trackId));
    }

    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/audio-features/${trackId}`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}})
      .pipe(
        catchError(err => {
          console.log('getTrackInfo error');
          return of(null);
        }),
        tap(res => {
          if (res) {
            this.cacheCache.set(trackId, res);
          }
        }),
        delay(100)
      )
  }

  public getArtistInfo(artistId: string): Observable<any> {
    if (this.artistCache.has(artistId)) {
      const cached = this.artistCache.get(artistId);
      console.log('artist from cache ' + cached.name);
      return of(cached);
    }

    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/artists/${artistId}`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}}).pipe(
      catchError(err => {
        console.log('getTrackInfo error');
        return of(null);
      }),
      tap(res => {
        this.artistCache.set(artistId, res);
      }),
      delay(100)
    );
  }

  public getTopArtists(): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}});
  }

  public findPlaylistByName(playlist: string, offset: number, limit: number): Observable<any | null> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/search?q=${playlist}&type=playlist&limit=${limit}&offset=${offset}&market=NL`;

    return this.http.get<any | null>(url, {headers: {Authorization: 'Bearer ' + token}})
      .pipe(
        catchError(_ => {
          console.log('findPlaylistByName error');
          return of(null);
        })
      )
  }

  public getRandomNumber(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  public getRandomElements(num: number, arr: { uri: string }[]): { uri: string }[] {
    const result: { uri: string }[] = [];
    while (result.length != num) {
      const nextRandom = this.getRandomNumber(0, arr.length - 1);
      const nextElement = arr[nextRandom];
      const found = result.find((item) => item.uri === nextElement.uri);
      if (!found) {
        result.push(nextElement);
      }
    }
    return result;
  }
}
