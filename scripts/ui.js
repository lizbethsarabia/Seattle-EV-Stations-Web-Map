// UI helpers for navigation and search
function toggleNav() {
  var x = document.getElementById("myTopnav");
  if (!x) return;
  if (x.className === "topnav") {
    x.className += " responsive";
  } else {
    x.className = "topnav";
  }
}

// Go to Top button logic
var myBtn = null;
window.addEventListener('DOMContentLoaded', function() {
  myBtn = document.getElementById('myBtn');
  window.onscroll = function() { scrollFunction(); };
  // wire up search form if present
  var f = document.getElementById('nav-search-form');
  if (f) {
    f.addEventListener('submit', function(evt) {
      evt.preventDefault();
      var q = (document.getElementById('nav-search')||{}).value || '';
      // For now just log the query; you can implement feature search here
      console.log('Search query:', q);
      alert('Search: ' + q);
    });
  }
});

function scrollFunction() {
  if (!myBtn) return;
  if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
    myBtn.style.display = "block";
  } else {
    myBtn.style.display = "none";
  }
}

function topFunction() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
