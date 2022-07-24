import {Injectable} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {catchError, delay, firstValueFrom, map, Observable, of} from "rxjs";
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

  public getPlaylistByName(name: string): Observable<any | null> {
    return this.getPlaylists().pipe(
      map(res => res.items),
      map((items: any[]) => items.filter(item => item.name === name)),
      map(items => items.length > 0 ? items[0] : null)
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

  public async deleteAllSong(playlist: any): Promise<any> {
    let playlistInfo: any = await firstValueFrom(this.getPlaylist(playlist.id));
    while (playlistInfo.tracks.items.length > 0) {
      await firstValueFrom(this.deleteTracksFromPlaylist(playlist.id, playlistInfo.tracks.items.map((item: any) => ({uri: item.track.uri}))));
      playlistInfo = await firstValueFrom(this.getPlaylist(playlist.id));
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

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}});
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

  public async processTrack(trackIndices: number[], energyMin: number = 0, energyMax: number = 100) {
    const tracksToAdd = [];
    const userTracks = [];

    let shouldCallRecommendation = false;
    for (let trackIndex of trackIndices) {
      const resolved = await this.resolveWithCache(trackIndex);

      const trackInfo = await firstValueFrom(this.getTrackInfo(resolved.id));

      if (trackInfo.energy >= energyMin && trackInfo.energy <= energyMax) {
        shouldCallRecommendation = true;
        tracksToAdd.push(resolved);
      }

      userTracks.push(resolved);
    }
    const recommendations = await firstValueFrom(this.getRecommendations(userTracks.map(ut => ut.id), energyMin, energyMax))
      .catch(err => {
        console.log(err);
        return {tracks: []}
      });

    if (recommendations.tracks.length !== 0) {
      const size = recommendations.tracks.length;
      const numberOfTracksToTake = Math.ceil(size * 0.4);
      const randomUris = this.getRandomElements(numberOfTracksToTake, recommendations.tracks);

      tracksToAdd.forEach(ut => randomUris.add(ut.uri));
      return randomUris;
    }
    return new Set<string>();
  }

  private async resolveWithCache(trackIndex: number): Promise<{ id: string; uri: string }> {
    if (!this.tracksCache[trackIndex]) {
      const userTracks = await firstValueFrom(this.getUserTracks(trackIndex, 50));
      userTracks.items.forEach((item: any, index: number) => this.tracksCache[trackIndex + index] = {
        id: item.track.id,
        uri: item.track.uri
      });
    }
    return this.tracksCache[trackIndex];
  }

  public getRecommendations(track: string[], energyMin: number = 0, energyMax: number = 1): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/recommendations/?seed_tracks=${track.join(',')}&market=NL&min_energy=${energyMin}&max_energy=${energyMax}`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}}).pipe(
      catchError(err => {
        console.log(err);
        return of({tracks: []});
      })
    )
  }

  public getTrackInfo(trackId: string): Observable<any> {
    const token = this.cookieService.get('spotify_token');
    const url = `https://api.spotify.com/v1/audio-features/${trackId}`;

    return this.http.get(url, {headers: {Authorization: 'Bearer ' + token}})
      .pipe(
        delay(100)
      )
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
