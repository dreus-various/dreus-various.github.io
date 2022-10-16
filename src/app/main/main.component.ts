import {Component, OnInit} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {Router} from "@angular/router";
import {SpotifyService} from "./spotify.service";
import {firstValueFrom, from, of, switchMap} from "rxjs";

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['main.component.css']
})
export class MainComponent implements OnInit {

  public loading: boolean = false;
  public filter: FilterType | null = null;

  private filterActions = {
    'energetic': (trackInfo: {energy: number, valence: number}): boolean => trackInfo.energy >= 0.5,
    'calm': (trackInfo: {energy: number, valence: number}): boolean => trackInfo.energy <= 0.5,
    'happy': (trackInfo: {energy: number, valence: number}): boolean => trackInfo.valence >= 0.5,
    'sad': (trackInfo: {energy: number, valence: number}): boolean => trackInfo.valence <= 0.5,
  }

  public loadingPercent: number = 0;

  constructor(private cookie: CookieService, private router: Router, private spotifyService: SpotifyService) {
  }

  public ngOnInit() {
    let spotifyToken = this.cookie.get('spotify_token');
    if (!spotifyToken) {
      this.router.navigate(['/']);
    }
    this.spotifyService.getUserInfo().subscribe(res => {
      this.spotifyService.setUserId(res.id)
    });
  }

  private getNext(offset: number, limit: number, arr: string[]): string[] {
    return arr.slice(offset, offset + limit);
  }

  public combineDailyMixes() {
    this.loading = true;

    this.spotifyService.getPlaylistByName('Combined daily mix').pipe(
      switchMap(res => {
        if (!res) {
          return this.spotifyService.saveNewPlaylist('Combined daily mix', '')
        }
        return of(res)
      }),
      switchMap(playlist => from(this.spotifyService.deleteAllSong(playlist))),
    ).subscribe(async combinedPlaylist => {
      const playlists: any = await firstValueFrom(this.spotifyService.getPlaylists());

      let tracks: string[] = [];

      for (let playlist of playlists.items) {
        if (playlist.name.includes('Discover Weekly')) {
          const detailedDiscoverWeeklyPlaylist = await firstValueFrom(this.spotifyService.getPlaylist(playlist.id));
          const currTracks = detailedDiscoverWeeklyPlaylist.tracks.items.map((item: any) => item.track.uri);
          tracks.push(...currTracks);
          continue;
        }
        if (playlist.name.includes('Daily Mix')) {
          const dailyPlaylist = await firstValueFrom(this.spotifyService.getPlaylist(playlist.id));
          const tracksIds = dailyPlaylist.tracks.items.map((item: any) => item.track.uri);

          tracks.push(...tracksIds);
        }
      }

      tracks = this.shuffle(tracks);

      let index = 0;
      const step = 100;
      let nextBatch = this.getNext(index, step, tracks);

      while (nextBatch.length !== 0) {
        await firstValueFrom(this.spotifyService.addToPlaylist(combinedPlaylist.id, nextBatch));
        index += step;
        nextBatch = this.getNext(index, step, tracks);
      }

      this.loading = false;
    })
  }

  public async generatePlaylist() {
    console.log(this.filter);
    this.loadingPercent = 0;
    this.loading = true;

    this.spotifyService.getPlaylistByName('Super random').pipe(
      switchMap(res => {
        if (!res) {
          return this.spotifyService.saveNewPlaylist('Super random', '')
        }
        return of(res)
      }),
      switchMap(playlist => from(this.spotifyService.deleteAllSong(playlist))),
    ).subscribe(async newPlaylist => {
      const allUserTracks: { id: string, uri: string }[] = [];

      let offset = 0;
      let userTracks = await firstValueFrom(this.spotifyService.getUserTracks(offset, 50));
      while (userTracks.items.length > 0) {
        allUserTracks.push(...userTracks.items.map((item: any) => ({id: item.track.id, uri: item.track.uri})))

        offset += 50;
        userTracks = await firstValueFrom(this.spotifyService.getUserTracks(offset, 50));
      }

      let numberOfTracks = 100;
      const tracksToAdd = new Set<string>();

      while (numberOfTracks > tracksToAdd.size) {
        offset = this.spotifyService.getRandomNumber(0, 999);

        const playlists = await firstValueFrom(this.spotifyService.findPlaylistByName("picked just for you", offset, 1));
        if (!playlists) {
          continue;
        }
        const playlist = playlists.playlists.items[0];
        const playlistInfo = await firstValueFrom(this.spotifyService.getPlaylist(playlist.id));
        if (!playlistInfo) {
          continue;
        }
        const playlistTracks: { id: string, uri: string }[] = playlistInfo.tracks.items.map((item: any) => ({id: item.track.id, uri: item.track.uri}));
        const found = playlistTracks.filter((track) => allUserTracks.find((userTrack) => userTrack.id === track.id && userTrack.uri === track.uri));
        if (found.length >= 5) {
          console.log(`${playlist.name} number of liked songs ${found.length}`);
          const randomTracks = this.spotifyService.getRandomElements(4, playlistTracks);
          randomTracks.push(found[this.spotifyService.getRandomNumber(0, found.length - 1)]);

          for (let randomTrack of randomTracks) {
            if (this.filter) {
              let trackInfo = await firstValueFrom(this.spotifyService.getTrackInfo(randomTrack.id));
              if (!trackInfo || !this.filterActions[this.filter](trackInfo)) {
                continue;
              }
            }
            tracksToAdd.add(randomTrack.uri);
          }
          const newPercent = tracksToAdd.size / numberOfTracks * 100;
          this.loadingPercent = newPercent > 100 ? 100 : newPercent;
          console.log(`current size ${tracksToAdd.size}`);
        }
      }

      let tracks = Array.from(tracksToAdd);
      this.shuffle(tracks);
      tracks = tracks.slice(0, 100);

      let index = 0;
      const step = 100;
      let nextBatch = this.getNext(index, step, tracks);

      while (nextBatch.length !== 0) {
        await firstValueFrom(this.spotifyService.addToPlaylist(newPlaylist.id, nextBatch));
        index += step;
        nextBatch = this.getNext(index, step, tracks);
      }
      this.loading = false;
    });
  }

  private shuffle(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

}

type FilterType = 'energetic' | 'calm' | 'happy' | 'sad';
