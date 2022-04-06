import {Component, OnInit} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {Router} from "@angular/router";
import {SpotifyService} from "./spotify.service";
import {firstValueFrom, from, map, of, Subject, switchMap} from "rxjs";

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['main.component.css']
})
export class MainComponent implements OnInit {

  private total$: Subject<{ total: number, playlistId: string }> = new Subject<{ total: number; playlistId: string }>();

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

    this.total$.subscribe(async total => {
      const currentTracks = new Set<string>();
      let currentNumber = 0;

      let randomNumber = this.spotifyService.getRandomNumber(0, total.total - 1);
      while (currentTracks.size <= 200 || currentNumber <= total.total * 0.15) {
        const uris = await firstValueFrom(this.spotifyService.processTrack(randomNumber));
        uris.forEach(uri => currentTracks.add(uri));
        currentNumber++;
        randomNumber = this.spotifyService.getRandomNumber(0, total.total - 1);
      }
      const currentTracksArray = Array.from(currentTracks);
      this.shuffleArray(currentTracksArray);

      let index = 0;
      const step = 100;
      let nextBatch = this.getNext(index, step, currentTracksArray);

      while (nextBatch.length !== 0) {
        await firstValueFrom(this.spotifyService.addToPlaylist(total.playlistId, nextBatch));
        index += step;
        nextBatch = this.getNext(index, step, currentTracksArray);
      }
    })
  }

  private getNext(offset: number, limit: number, arr: string[]): string[] {
    return arr.slice(offset, offset + limit);
  }

  public generatePlaylist() {
    this.spotifyService.clearCache();

    this.spotifyService.getPlaylistByName('Dreus recommendation playlist').pipe(
      switchMap(res => {
        if (!res) {
          return this.spotifyService.saveNewPlaylist('Dreus recommendation playlist', 'Recommendations for you')
        }
        return of(res);
      }),
      switchMap(playlistId => from(this.spotifyService.deleteAllSong(playlistId))),
      switchMap(playlistId => this.spotifyService.getTotalUserTracks().pipe(
        map(total => ({total, playlistId}))
      )),
    ).subscribe(res => {
      this.total$.next(res);
    });
  }

  private shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }
}
