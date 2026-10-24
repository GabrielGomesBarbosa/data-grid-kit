"""frames/*.png + frames.json -> docs/media/demo.gif (and the dark screenshot). Needs Pillow."""
import json
from pathlib import Path
from PIL import Image

here = Path(__file__).parent
frames = json.loads((here / 'frames' / 'frames.json').read_text())
out = here.parent.parent / 'docs' / 'media'
out.mkdir(parents=True, exist_ok=True)
WIDTH = 1000

images, durations = [], []
for f in frames:
    im = Image.open(here / 'frames' / f['file']).convert('RGB')
    h = round(im.height * WIDTH / im.width)
    im = im.resize((WIDTH, h), Image.LANCZOS)
    images.append(im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    durations.append(f['ms'])
images[0].save(out / 'demo.gif', save_all=True, append_images=images[1:], duration=durations, loop=0, optimize=True, disposal=1)
Image.open(here / 'frames' / frames[0]['file']).save(out / 'screenshot-dark.png', optimize=True)
print('demo.gif', round((out / 'demo.gif').stat().st_size / 1024), 'KB,', len(images), 'frames')
