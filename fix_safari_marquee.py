import re

css_file = "assets/css/landing.css"
with open(css_file, "r") as f:
    css = f.read()

# Replace animation on .marquee-content to a .running modifier
css = css.replace("  animation: scroll-marquee 18s linear infinite;\n", "")
css = css.replace("  -webkit-animation: scroll-marquee 18s linear infinite;\n", "")
css = css.replace(".marquee-content {", ".marquee-content {\n  /* Animation delayed for Safari */")

running_class = """
.marquee-content.running {
  animation: scroll-marquee 18s linear infinite;
  -webkit-animation: scroll-marquee 18s linear infinite;
}
"""
css = css.replace("will-change: transform;\n}", "will-change: transform;\n}\n" + running_class)

with open(css_file, "w") as f:
    f.write(css)


js_file = "assets/js/landing.js"
with open(js_file, "r") as f:
    js = f.read()

# Modify JS to add the .running class after images load
replacement = """
    track.innerHTML = html;
    track2.innerHTML = html;
    
    // Force reflow and add animation class for Safari WebKit fix
    requestAnimationFrame(() => {
      track.classList.add('running');
      track2.classList.add('running');
    });
"""
js = js.replace("    track.innerHTML = html;\n    track2.innerHTML = html;", replacement)

with open(js_file, "w") as f:
    f.write(js)

print("Safari marquee fix applied.")
