# Sounds

Drop audio files here using these names (mp3, wav or ogg all work — just update the
extension in `js/config.js` if you don't use mp3):

| File                         | When it plays                     |
|------------------------------|-----------------------------------|
| `countdown.mp3`              | each beat of the 3-2-1 countdown  |
| `go.mp3`                     | round starts                      |
| `lock.mp3`                   | a letter gets used                |
| `tick.mp3`                   | each of the last few seconds      |
| `buzzer-1.mp3`, `-2`, `-3`…  | timer runs out (random pick)      |
| `win.mp3`                    | all 26 letters used               |

**Buzzer** picks one of its files at random each time (never the same one twice in a row).
Name yours `buzzer-1.mp3`, `buzzer-2.mp3`, `buzzer-3.mp3`. Got more than three, or a
different extension? Edit the `buzzer` list in `js/config.js`. Any listed file that's
missing is skipped.

Any sound with no files at all falls back to a built-in synth beep, so you can replace
them one at a time. Paths and the default volume are set in `js/config.js`; the slider on the setup screen adjusts volume per device.

## Credits

`countdown`, `go`, `lock`, `tick` and `win` come from the **Arcade** pack in
[UI SFX](https://uisfx.com) (npm `uisfx` v0.4.0), CC0 / public domain:

| File            | UI SFX cue      |
|-----------------|-----------------|
| `countdown.mp3` | `progress-step` |
| `go.mp3`        | `start`         |
| `lock.mp3`      | `snap`          |
| `tick.mp3`      | `typing`        |
| `win.mp3`       | `achievement`   |

Preview all 936 sounds at uisfx.com to swap any of them.
