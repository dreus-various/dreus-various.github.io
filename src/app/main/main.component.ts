import {Component, OnInit} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {Router} from "@angular/router";
import {SpotifyService} from "./spotify.service";
import {firstValueFrom, from, map, of, switchMap} from "rxjs";

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['main.component.css']
})
export class MainComponent implements OnInit {

  private playlistName = 'Dreus radio playlist';

  public loading: boolean = false;
  energyLevel: EnergyLevelType[] = ['medium-energy'];

  private energyLevelMap = {
    'super-low-energy': {min: 0, max: 0.2},
    'low-energy': {min: 0.2, max: 0.4},
    'medium-energy': {min: 0.4, max: 0.6},
    'high-energy': {min: 0.6, max: 0.8},
    'super-high-energy': {min: 0.8, max: 1},
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

      for (let playlist of playlists.items) {
        if (!playlist.name.includes('Daily Mix')) {
          continue;
        }
        const dailyPlaylist = await firstValueFrom(this.spotifyService.getPlaylist(playlist.id));
        const tracksIds = dailyPlaylist.tracks.items.map((item: any) => item.track.uri)

        await firstValueFrom(this.spotifyService.addToPlaylist(combinedPlaylist.id, tracksIds));
      }

      this.loading = false;
    })
  }

  public async generatePlaylist() {
    this.loadingPercent = 0;
    this.loading = true;
    this.spotifyService.clearCache();

    this.generatePlaylistForMood(this.energyLevel);
  }

  private generatePlaylistForMood(energyLevelType: EnergyLevelType[]) {
    if (energyLevelType.length === 0) {
      energyLevelType.push('medium-energy');
    }

    let min = 1;
    let max = 0;
    for (let energyLevelTypeElement of energyLevelType) {
      let energyLevelMapElement = this.energyLevelMap[energyLevelTypeElement];

      if (energyLevelMapElement.min < min) {
        min = energyLevelMapElement.min;
      }
      if (energyLevelMapElement.max > max) {
        max = energyLevelMapElement.max;
      }
    }

    this.spotifyService.getPlaylistByName(this.playlistName).pipe(
      switchMap(res => {
        if (!res) {
          return this.spotifyService.saveNewPlaylist(this.playlistName, '')
        }
        return of(res);
      }),
      switchMap(playlist => from(this.spotifyService.deleteAllSong(playlist))),
      switchMap((playlist: any) => this.spotifyService.getTotalUserTracks().pipe(
        map(total => ({total, playlist}))
      )),
    ).subscribe(async total => {
      let currentNumberForSeed = 2;

      const currentTracks = new Set<string>();
      let currentNumber = 0;

      while (currentTracks.size <= 300 && currentNumber <= total.total * 0.2) {
        const tracksPercent = currentTracks.size / 300 * 100;
        const currentNumberPercent = currentNumber / (total.total * 0.2) * 100;

        this.loadingPercent = tracksPercent > currentNumberPercent ? tracksPercent : currentNumberPercent;

        const indices = [];
        for (let i = 0; i < currentNumberForSeed; i++) {
          indices.push(this.spotifyService.getRandomNumber(0, total.total - 1));
        }

        const uris = await this.spotifyService.processTrack(indices, min, max);
        uris.forEach(uri => currentTracks.add(uri));
        currentNumber++;
        currentNumberForSeed = this.getNextNumberOfTracks(currentNumberForSeed);
      }
      let currentTracksArray = Array.from(currentTracks);
      currentTracksArray = this.shuffle(currentTracksArray);

      console.log(`Size of tracks to add ${currentTracksArray.length}`)
      let index = 0;
      const step = 100;
      let nextBatch = this.getNext(index, step, currentTracksArray);

      while (nextBatch.length !== 0) {
        await firstValueFrom(this.spotifyService.addToPlaylist(total.playlist.id, nextBatch));
        index += step;
        nextBatch = this.getNext(index, step, currentTracksArray);
      }

      // setTimeout(async () => await firstValueFrom(this.spotifyService.addPlayback(total.playlist.uri)), 500);

      this.loading = false;
    })
  }

  private shuffle(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private getNextNumberOfTracks(num: number): number {
    if (num >= 4) {
      return 2;
    }
    if (num < 2) {
      return 2;
    }
    return num + 1;
  }
}

type EnergyLevelType =
  'super-low-energy'
  | 'low-energy'
  | 'medium-energy'
  | 'high-energy'
  | 'super-high-energy';
