import {Injectable} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {delay, EMPTY, expand, firstValueFrom, map, Observable, of, switchMap, tap} from "rxjs";
import {HttpClient} from "@angular/common/http";

@Injectable({providedIn: 'root'})
export class SpotifyService {

  private userId: string = '';

  private tracksCache: { id: string, uri: string }[] = [];

  constructor(private cookieService: CookieService, private http: HttpClient) {
  }

  public clearCache() {
    this.tracksCache = [];
  }

  public getPlaylistByName(name: string): Observable<string | null> {
    return this.getPlaylists().pipe(
      map(res => res.items),
      map((items: any[]) => items.filter(item => item.name === name)),
      map(items => items.length > 0 ? items[0].id : null)
    )
  }

  public getPlaylists(): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/me/playlists`;

    return this.http.get(url, {
      headers: {
        Authorization: 'Bearer ' + token
      }
    })
  }

  public getPlaylist(id: string): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/playlists/${id}`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}});
  }

  public addToPlaylist(id: string, uris: string[]) {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/playlists/${id}/tracks`;

    return this.http.post(url, {
      uris,
      position: 0
    }, {headers: {Authorization: 'Bearer ' + token}});
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

  public saveNewPlaylist(name: string, description: string): Observable<string> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/users/${this.userId}/playlists`;

    return this.http.post(url, {
      'public': false,
      name,
      description
    }, {headers: {Authorization: 'Bearer ' + token}}).pipe(
      map((res: any) => res.id)
    )
  }

  public async deleteAllSong(id: string): Promise<string> {
    let playlist: any = await firstValueFrom(this.getPlaylist(id));
    while (playlist.tracks.items.length > 0) {
      await firstValueFrom(this.deleteTracksFromPlaylist(id, playlist.tracks.items.map((item: any) => ({uri: item.track.uri}))));
      playlist = await firstValueFrom(this.getPlaylist(id));
    }
    return id;
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

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}});
  }

  public processTrack(trackIndex: number): Observable<Set<string>> {
    return of(this.tracksCache[trackIndex]).pipe(
      switchMap(trackInfo => !!trackInfo ? of(trackInfo) : this.getUserTracks(trackIndex, 50).pipe(
        tap(res => res.items.forEach((item: any, index: number) => this.tracksCache[trackIndex + index] = {
          id: item.track.id,
          uri: item.track.uri
        })),
        map(res => ({id: res.items[0].track.id, uri: res.items[0].track.uri}))
      )),
      switchMap(trackInfo => this.getRecommendations(trackInfo.id).pipe(
        map(res => ({recommendations: res, trackInfo}))
      )),
      map((nextItem: any) => {
        const size = nextItem.recommendations.tracks.length;
        const numberOfTracksToTake = Math.ceil(size * 0.4);
        const randomUris = this.getRandomElements(numberOfTracksToTake, nextItem.recommendations.tracks);
        randomUris.add(nextItem.trackInfo.uri)
        return randomUris;
      })
    )
  }

  public getRecommendations(track: string) {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/recommendations/?seed_tracks=${track}&market=NL`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}});
  }

  public getRandomNumber(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  public getRandomElements(num: number, arr: any[]): Set<string> {
    const set = new Set<any>();
    while (set.size != num) {
      const nextRandom = this.getRandomNumber(0, arr.length - 1);
      const nextElement = arr[nextRandom].uri;
      set.add(nextElement);
    }
    return set;
  }
}
